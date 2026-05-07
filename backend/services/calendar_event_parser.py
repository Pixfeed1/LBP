"""Parser de descriptions d'events Google Calendar.

Extrait les champs structures de la description d'un event pour creer
une intervention.

Format attendu (lignes dans la description) :
  TEL ASSU: +33612345678
  EMAIL ASSU: client@example.com
  REFERENCE: REF-2026-0042
  ADRESSE: 12 rue de la Paix, 75001 Paris
  TRAVAUX: Remplacement chaudiere
  MONTANT_HT: 1500
  MONTANT_TTC: 1800
  LOGEMENT_2_ANS: Y       (optionnel, default Y)

Le parser est tolerant : casse insensible, espaces autour des ":", etc.
"""
import re
from datetime import datetime
from typing import Dict, Optional, Any
from loguru import logger


# Patterns regex tolerants : 'TEL ASSU:' ou 'tel assu :' etc.
PATTERNS = {
    "client_telephone": [r"TEL\s*ASSU\s*:\s*([+\d\s\.\-\(\)]+)", r"TEL\s*:\s*([+\d\s\.\-\(\)]+)", r"TELEPHONE\s*:\s*([+\d\s\.\-\(\)]+)"],
    "client_email": [r"EMAIL\s*ASSU\s*:\s*([^\s\n]+@[^\s\n]+)", r"EMAIL\s*:\s*([^\s\n]+@[^\s\n]+)", r"MAIL\s*:\s*([^\s\n]+@[^\s\n]+)"],
    "reference": [r"REF(?:ERENCE)?\s*:\s*([^\n]+)"],
    "client_adresse_full": [r"ADRESSE\s*:\s*([^\n]+)"],
    "description_travaux": [r"TRAVAUX\s*:\s*([^\n]+)", r"DESCRIPTION\s*:\s*([^\n]+)"],
    "montant_ht": [r"MONTANT[_\s]*HT\s*:\s*([\d\s\.,]+)", r"PRIX[_\s]*HT\s*:\s*([\d\s\.,]+)"],
    "montant_ttc": [r"MONTANT[_\s]*TTC\s*:\s*([\d\s\.,]+)", r"PRIX[_\s]*TTC\s*:\s*([\d\s\.,]+)", r"MONTANT\s*:\s*([\d\s\.,]+)"],
    "logement_plus_2_ans": [r"LOGEMENT[_\s]*\+?2[_\s]*ANS\s*:\s*([YN])", r"LOGEMENT[_\s]*2[_\s]*ANS\s*:\s*([YN])"],
}


def _extract_first(patterns: list, text: str) -> Optional[str]:
    """Cherche les patterns dans l'ordre, retourne la premiere capture trouvee."""
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def _normalize_phone(phone: str) -> str:
    """Normalise un numero FR : retire espaces/points/tirets, prefixe +33 si commence par 0."""
    cleaned = re.sub(r"[\s\.\-\(\)]", "", phone)
    if cleaned.startswith("0"):
        cleaned = "+33" + cleaned[1:]
    elif cleaned.startswith("33") and not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    elif not cleaned.startswith("+"):
        cleaned = "+33" + cleaned.lstrip("0")
    return cleaned


def _parse_amount(amount_str: str) -> Optional[int]:
    """Parse un montant (ex: '1 500,50' -> 150050 centimes)."""
    if not amount_str:
        return None
    cleaned = amount_str.replace(" ", "").replace(",", ".").strip()
    try:
        euros = float(cleaned)
        return int(round(euros * 100))
    except (ValueError, TypeError):
        return None


def _parse_address(address_full: str) -> Dict[str, str]:
    """Decoupe une adresse '12 rue X, 75001 Paris' en {adresse, code_postal, ville}.

    Tolerant : si pas de virgule, on essaie de detecter le code postal (5 chiffres).
    """
    if not address_full:
        return {"client_adresse": "", "client_code_postal": "", "client_ville": ""}

    # Cherche un code postal a 5 chiffres
    cp_match = re.search(r"\b(\d{5})\b", address_full)
    if cp_match:
        cp = cp_match.group(1)
        # Decoupe : avant CP -> adresse, apres CP -> ville
        parts = address_full.split(cp)
        adresse = parts[0].rstrip(", ").strip()
        ville = parts[1].lstrip(", ").strip() if len(parts) > 1 else ""
        return {
            "client_adresse": adresse,
            "client_code_postal": cp,
            "client_ville": ville,
        }
    # Pas de CP detecte : tout dans adresse
    return {"client_adresse": address_full.strip(), "client_code_postal": "", "client_ville": ""}


def parse_event(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse un event Google Calendar et retourne un dict d'intervention.

    Returns:
        Dict avec les champs intervention si parsing reussi, None sinon
        (ex: si ni TEL ASSU ni TEL trouve dans la description).
    """
    # Description = source principale des metadata
    description = event.get("description", "") or ""

    # Title (summary) = nom du client en general
    summary = event.get("summary", "") or ""

    # Si pas de description ou pas de telephone, on ne traite pas
    phone_raw = _extract_first(PATTERNS["client_telephone"], description)
    if not phone_raw:
        logger.debug(f"[PARSER] Skip event '{summary[:30]}' : pas de TEL ASSU")
        return None

    # Decoupe summary "Nom Prenom" -> nom + prenom
    parts = summary.strip().split()
    if len(parts) >= 2:
        client_nom = parts[0]
        client_prenom = " ".join(parts[1:])
    else:
        client_nom = summary.strip()
        client_prenom = ""

    # Date/heure RDV
    start = event.get("start", {})
    start_dt_str = start.get("dateTime") or start.get("date")
    if not start_dt_str:
        logger.warning(f"[PARSER] Event sans date : {summary}")
        return None
    try:
        # Format ISO avec ou sans timezone
        date_rdv = datetime.fromisoformat(start_dt_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        logger.warning(f"[PARSER] Date invalide : {start_dt_str}")
        return None

    # Duree
    end = event.get("end", {})
    end_dt_str = end.get("dateTime") or end.get("date")
    duree_minutes = 60  # default
    if end_dt_str:
        try:
            end_dt = datetime.fromisoformat(end_dt_str.replace("Z", "+00:00")).replace(tzinfo=None)
            duree_minutes = max(15, int((end_dt - date_rdv).total_seconds() / 60))
        except (ValueError, TypeError):
            pass

    # Adresse decoupage
    address_data = _parse_address(_extract_first(PATTERNS["client_adresse_full"], description) or "")

    # Logement +2 ans : default Y
    logement = _extract_first(PATTERNS["logement_plus_2_ans"], description) or "Y"
    logement = logement.upper()
    if logement not in ("Y", "N"):
        logement = "Y"

    return {
        "google_event_id": event.get("id"),
        "client_nom": client_nom,
        "client_prenom": client_prenom,
        "client_telephone": _normalize_phone(phone_raw),
        "client_email": _extract_first(PATTERNS["client_email"], description),
        "client_adresse": address_data["client_adresse"],
        "client_code_postal": address_data["client_code_postal"],
        "client_ville": address_data["client_ville"],
        "date_rdv": date_rdv,
        "duree_estimee": duree_minutes,
        "description_travaux": _extract_first(PATTERNS["description_travaux"], description) or summary,
        "montant_devis_ht": _parse_amount(_extract_first(PATTERNS["montant_ht"], description) or ""),
        "montant_devis_ttc": _parse_amount(_extract_first(PATTERNS["montant_ttc"], description) or ""),
        "logement_plus_2_ans": logement,
    }
