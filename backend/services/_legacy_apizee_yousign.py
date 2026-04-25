#!/usr/bin/env python3
"""
Integration Apizee → Yousign
Modes :
  - "link"  : retourne le lien de signature (le client l'envoie manuellement)
  - "sms"   : envoie automatiquement le lien par SMS via Twilio
  - "email" : Yousign envoie directement par email (nécessite email du client)
"""

import requests
import re
import os
import argparse
from html import unescape
from datetime import datetime
from fill_pdfs import fill_all_pdfs

# ============================================================
# CONFIGURATION
# ============================================================

APIZEE_CONFIG = {
    "base_url": os.getenv("APIZEE_BASE_URL", "https://cloud.apizee.com/api"),
    "username": os.getenv("APIZEE_USERNAME", "Contact@lesbonsplombiers.com"),
    "password": os.getenv("APIZEE_PASSWORD", "Lesbonsplombiers94!"),
}

YOUSIGN_CONFIG = {
    "base_url": os.getenv("YOUSIGN_BASE_URL", "https://api-sandbox.yousign.app/v3"),
    "api_key": os.getenv("YOUSIGN_API_KEY", "GlGd1SzI7ltZuLOSJX9anSUByuTjAkZp"),
}

TWILIO_CONFIG = {
    "account_sid": os.getenv("TWILIO_ACCOUNT_SID", ""),
    "auth_token": os.getenv("TWILIO_AUTH_TOKEN", ""),
    "from_number": os.getenv("TWILIO_FROM_NUMBER", ""),
}

PDF_DIR = os.getenv("PDF_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdfs"))
PDF_FILES = {
    "attestation_tva": os.path.join(PDF_DIR, "Attestation TVA.pdf"),
    "proces_verbal": os.path.join(PDF_DIR, "Procès Verbal.pdf"),
    "delegation_paiement": os.path.join(PDF_DIR, "Délégation de paiement (1).pdf"),
}

# Smart Anchors intégrés dans les PDFs : {{s1|signature|180|78}}
# Plus besoin de coordonnées manuelles, Yousign détecte automatiquement

# ============================================================
# APIZEE
# ============================================================

def apizee_get_token():
    print("[APIZEE] Authentification...")
    resp = requests.post(
        f"{APIZEE_CONFIG['base_url']}/token",
        json={"grant_type": "password", "username": APIZEE_CONFIG["username"], "password": APIZEE_CONFIG["password"]},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    print(f"[APIZEE] Token obtenu : {token[:12]}...")
    return token

def apizee_get_ticket(token, ticket_id):
    print(f"[APIZEE] Récupération du ticket #{ticket_id}...")
    resp = requests.get(
        f"{APIZEE_CONFIG['base_url']}/tickets/{ticket_id}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    resp.raise_for_status()
    ticket = resp.json()
    print(f"[APIZEE] Ticket #{ticket_id} récupéré - Type: {ticket.get('type')}, Ref: {ticket.get('reference')}")
    return ticket

# ============================================================
# PARSING
# ============================================================

def clean_html(html_text):
    if not html_text:
        return ""
    text = html_text.replace("&nbsp;", "\t")
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"</?p>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()

def parse_ticket_description(description):
    text = clean_html(description)
    print(f"[PARSE] Texte nettoyé :\n{text}\n")

    data = {"contrat": "", "sinistre": "", "nom": "", "prenom": "", "adresse": "",
            "code_postal": "", "ville": "", "email": "", "description_travaux": ""}

    match = re.search(r"Contrat\s*:\s*(\S+)", text)
    if match:
        data["contrat"] = match.group(1).strip()

    match = re.search(r"Sinistre\s*:\s*(\S+)", text)
    if match:
        data["sinistre"] = match.group(1).strip()

    match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    if match:
        data["email"] = match.group(0).strip()

    match = re.search(r"\*([^*]+?)(?:\n|\*\*)", text, re.DOTALL)
    if match:
        identity_line = match.group(1).strip()
        parts = re.split(r"\t{2,}|\s{3,}", identity_line)
        parts = [p.strip() for p in parts if p.strip()]

        if len(parts) >= 1:
            name_parts = parts[0].strip().split()
            if len(name_parts) >= 2:
                data["nom"] = name_parts[0]
                data["prenom"] = " ".join(name_parts[1:])
            elif len(name_parts) == 1:
                data["nom"] = name_parts[0]
        if len(parts) >= 2:
            data["adresse"] = parts[1].strip()
        if len(parts) >= 3:
            cp_ville = parts[2].strip()
            cp_match = re.match(r"(\d{5})\s*[-–]\s*(.+)", cp_ville)
            if cp_match:
                data["code_postal"] = cp_match.group(1)
                data["ville"] = cp_match.group(2).strip()
            else:
                data["ville"] = cp_ville

    match = re.search(r"\*\*(.+)", text, re.DOTALL)
    if match:
        data["description_travaux"] = match.group(1).strip()

    return data

def parse_ticket(ticket):
    description_data = parse_ticket_description(ticket.get("description", ""))

    phone = ""
    requestor = ticket.get("requestor", {})
    if requestor and "phone" in requestor:
        phones = requestor["phone"]
        if isinstance(phones, list) and phones:
            phone = phones[0]
        elif isinstance(phones, str):
            phone = phones

    # Extraire la date du RDV
    date_rdv = ""
    start_time = ticket.get("start_time", "")
    if start_time:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            date_rdv = dt.strftime("%d/%m/%Y")
        except:
            date_rdv = ""

    result = {"ticket_id": ticket.get("id"), "reference_ma": ticket.get("reference", ""),
              "type": ticket.get("type", ""), "telephone": phone, "agent": ticket.get("agent", ""),
              "date_rdv": date_rdv,
              **description_data}

    print("\n[PARSE] Données extraites :")
    for key, value in result.items():
        print(f"  {key}: {value}")
    print()
    return result

# ============================================================
# TWILIO SMS
# ============================================================

def send_sms_twilio(to_number, message):
    if not all([TWILIO_CONFIG["account_sid"], TWILIO_CONFIG["auth_token"], TWILIO_CONFIG["from_number"]]):
        raise Exception("Twilio non configuré. Renseignez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER.")
    print(f"[TWILIO] Envoi SMS à {to_number} depuis {TWILIO_CONFIG['from_number']}...")
    resp = requests.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_CONFIG['account_sid']}/Messages.json",
        auth=(TWILIO_CONFIG["account_sid"], TWILIO_CONFIG["auth_token"]),
        data={"From": TWILIO_CONFIG["from_number"], "To": to_number, "Body": message},
    )
    resp.raise_for_status()
    result = resp.json()
    print(f"[TWILIO] SMS envoyé ! SID: {result.get('sid')}")
    return result

# ============================================================
# YOUSIGN
# ============================================================

def yousign_headers():
    return {"Authorization": f"Bearer {YOUSIGN_CONFIG['api_key']}", "Accept": "application/json"}

def yousign_create_signature_request(client_data, mode="link"):
    print(f"[YOUSIGN] Création de la signature request (mode: {mode})...")
    delivery_mode = "email" if mode == "email" else "none"
    payload = {
        "name": f"Signature - {client_data['nom']} {client_data['prenom']} - Ref {client_data['reference_ma']}",
        "delivery_mode": delivery_mode,
        "timezone": "Europe/Paris",
        "ordered_signers": False,
        "external_id": str(client_data["ticket_id"]),
    }
    resp = requests.post(
        f"{YOUSIGN_CONFIG['base_url']}/signature_requests",
        headers={**yousign_headers(), "Content-Type": "application/json"},
        json=payload,
    )
    resp.raise_for_status()
    sr = resp.json()
    print(f"[YOUSIGN] Signature request créée : {sr['id']}")
    return sr

def yousign_upload_document(signature_request_id, pdf_path, name):
    print(f"[YOUSIGN] Upload document : {name}...")
    if not os.path.exists(pdf_path):
        print(f"[ERREUR] Fichier introuvable : {pdf_path}")
        return None
    with open(pdf_path, "rb") as f:
        resp = requests.post(
            f"{YOUSIGN_CONFIG['base_url']}/signature_requests/{signature_request_id}/documents",
            headers={"Authorization": f"Bearer {YOUSIGN_CONFIG['api_key']}"},
            files={"file": (os.path.basename(pdf_path), f, "application/pdf")},
            data={"nature": "signable_document", "parse_anchors": "true"},
        )
    resp.raise_for_status()
    doc = resp.json()
    print(f"[YOUSIGN] Document uploadé : {doc['id']}")
    return doc

def yousign_add_signer(signature_request_id, client_data, document_ids, mode="link"):
    print(f"[YOUSIGN] Ajout du signataire : {client_data['prenom']} {client_data['nom']} (mode: {mode})...")

    email = client_data["email"] if mode == "email" and client_data.get("email") else "signature@lesbonsplombiers.com"

    # Pas de fields manuels : les Smart Anchors dans les PDFs gèrent le positionnement
    payload = {
        "info": {"first_name": client_data["prenom"] or "Client", "last_name": client_data["nom"] or "Inconnu",
                 "email": email, "phone_number": client_data["telephone"], "locale": "fr"},
        "signature_level": "electronic_signature",
        "signature_authentication_mode": "no_otp",
    }
    resp = requests.post(
        f"{YOUSIGN_CONFIG['base_url']}/signature_requests/{signature_request_id}/signers",
        headers={**yousign_headers(), "Content-Type": "application/json"},
        json=payload,
    )
    resp.raise_for_status()
    signer = resp.json()
    print(f"[YOUSIGN] Signataire ajouté : {signer['id']}")
    return signer

def yousign_activate(signature_request_id):
    print(f"[YOUSIGN] Activation de la signature request...")
    resp = requests.post(
        f"{YOUSIGN_CONFIG['base_url']}/signature_requests/{signature_request_id}/activate",
        headers=yousign_headers(),
    )
    resp.raise_for_status()
    sr = resp.json()
    print(f"[YOUSIGN] Signature request activée ! Status: {sr['status']}")
    return sr

def yousign_get_signature_link(signature_request_id, signer_id):
    print(f"[YOUSIGN] Récupération du lien de signature...")
    resp = requests.get(
        f"{YOUSIGN_CONFIG['base_url']}/signature_requests/{signature_request_id}/signers/{signer_id}",
        headers=yousign_headers(),
    )
    resp.raise_for_status()
    signer = resp.json()
    link = signer.get("signature_link")
    print(f"[YOUSIGN] Lien de signature : {link}")
    return link

def yousign_get_signed_pdf(signature_request_id, document_id):
    print(f"[YOUSIGN] Téléchargement du PDF signé...")
    resp = requests.get(
        f"{YOUSIGN_CONFIG['base_url']}/signature_requests/{signature_request_id}/documents/{document_id}/download",
        headers={"Authorization": f"Bearer {YOUSIGN_CONFIG['api_key']}"},
    )
    resp.raise_for_status()
    return resp.content

# ============================================================
# FLOW PRINCIPAL
# ============================================================

def run_integration(ticket_id, mode="link", dry_run=False):
    print("=" * 60)
    print(f"  INTEGRATION APIZEE → YOUSIGN")
    print(f"  Ticket ID: {ticket_id} | Mode: {mode.upper()}{' (DRY RUN)' if dry_run else ''}")
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    token = apizee_get_token()
    ticket = apizee_get_ticket(token, ticket_id)
    client_data = parse_ticket(ticket)

    if dry_run:
        print("\n[DRY RUN] Parsing OK, pas d'envoi Yousign.")
        return client_data

    if mode == "email" and not client_data.get("email"):
        raise Exception("Mode email demandé mais pas d'email client dans le ticket.")
    if mode == "sms" and not client_data.get("telephone"):
        raise Exception("Mode SMS demandé mais pas de téléphone dans le ticket.")

    sr = yousign_create_signature_request(client_data, mode=mode)
    sr_id = sr["id"]

    # Remplir les PDFs avec les données client
    print("[PDF] Remplissage des PDFs avec les données client...")
    filled_pdfs = fill_all_pdfs(PDF_FILES, client_data)

    document_ids = []
    for key in PDF_FILES.keys():
        pdf_path = filled_pdfs.get(key, PDF_FILES[key])
        doc = yousign_upload_document(sr_id, pdf_path, key)
        document_ids.append(doc["id"] if doc else None)

    signer = yousign_add_signer(sr_id, client_data, document_ids, mode=mode)
    signer_id = signer["id"]

    result = yousign_activate(sr_id)

    signature_link = None
    if mode in ("link", "sms"):
        signature_link = yousign_get_signature_link(sr_id, signer_id)

    if mode == "sms" and signature_link:
        sms_message = (
            f"Bonjour {client_data['prenom']} {client_data['nom']}, "
            f"Les Bons Plombiers vous invite a signer vos documents : {signature_link}"
        )
        send_sms_twilio(client_data["telephone"], sms_message)

    print("\n" + "=" * 60)
    print(f"  Signature Request ID: {sr_id}")
    print(f"  Status: {result['status']}")
    print(f"  Client: {client_data['prenom']} {client_data['nom']}")
    if mode == "email":
        print(f"  Email envoyé à: {client_data['email']}")
    elif mode == "sms":
        print(f"  SMS envoyé au: {client_data['telephone']}")
    elif mode == "link":
        print(f"  Lien: {signature_link}")
    print("=" * 60)

    return {"signature_request_id": sr_id, "status": result["status"],
            "signature_link": signature_link, "signer_id": signer_id}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Integration Apizee → Yousign")
    parser.add_argument("--ticket-id", type=int, required=True)
    parser.add_argument("--mode", choices=["link", "sms", "email"], default="link",
                        help="link: retourne le lien | sms: envoie par Twilio | email: Yousign envoie")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run_integration(args.ticket_id, mode=args.mode, dry_run=args.dry_run)
