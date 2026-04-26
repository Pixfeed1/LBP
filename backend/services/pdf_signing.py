"""
Service d'incrustation de la signature manuscrite dans les PDFs déjà générés.

Workflow :
1. Lit le PDF unsigned + l'image canvas base64 de la signature
2. Décode le PNG, l'incruste à la zone "signature client" du PDF
3. Ajoute un bandeau juridique en bas de TOUTES les pages
   (Signé électroniquement le X par Y - IP Z - SHA-256: hash...)
4. Sauve dans file_path_signed et met à jour la DB

Idempotent : régénère systématiquement file_path_signed depuis file_path_unsigned.
N'échoue jamais le workflow signature : try/except dans la route appelante.
"""
import base64
import io
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

import fitz  # PyMuPDF
from loguru import logger
from sqlalchemy.orm import Session

from models import Document, Signature
from models.document import DocumentType, DocumentStatus


# ============================================================
# COORDONNÉES HARDCODÉES DES ZONES SIGNATURE CLIENT
# ============================================================
# Format : (page_index, x, y, width, height) en points (72pt = 1 pouce)
# A4 = 595 x 842 points
# Page index : 0 = première page, -1 = dernière page
#
# Zones définies après inspection visuelle des templates.
# Si rendu incorrect → ajuster ici, relancer le script rétro (idempotent).

SIGNATURE_ZONES: Dict[str, Dict[str, Any]] = {
    # PV (généré ReportLab) : signature client = sous "Date et Signature du Client"
    # Ancre trouvée à x=51, y=471 (1ere occurrence). 12pt sous le label.
    "proces_verbal": {
        "page": 0,
        "x": 51,                                        # fallback si ancre introuvable
        "y": 483,                                       # 12pt sous l'ancre y=471
        "width": 130,
        "height": 50,
        "fallback_search": "Date et Signature du Client",
        "search_offset_x": 0,
        "search_offset_y": 12,                          # 12pt sous le label
    },
    # Fiche travaux (généré ReportLab) : signature client = sous "Date et Signature du Client"
    # Ancre trouvée à x=374, y=513. Signature placée 15pt sous ce label.
    "fiche_travaux": {
        "page": 0,
        "x": 374,                                       # fallback si ancre introuvable
        "y": 525,                                       # 12pt sous l'ancre
        "width": 130,
        "height": 50,
        "fallback_search": "Date et Signature du Client",
        "search_offset_x": 0,
        "search_offset_y": 12,                          # 12pt sous le label
    },
    # Attestation TVA (template externe rempli PyMuPDF)
    # Ancre : "Fait à" + offset
    # Si search_for("Fait à") échoue → fallback hardcodé
    "attestation_tva": {
        "page": 0,
        "x": 350,
        "y": 720,
        "width": 130,
        "height": 50,
        "fallback_search": "Fait à",   # ancre si dispo
        "search_offset_x": 60,
        "search_offset_y": 30,
        "needs_white_bg": True,        # rect blanc opaque pour cacher zone existante
    },
    # Délégation paiement (template externe) — pas dans workflow actif
    # Mais on prévoit le cas
    "delegation_paiement": {
        "page": 0,
        "x": 320,
        "y": 700,
        "width": 130,
        "height": 50,
        "fallback_search": "Fait à",
        "search_offset_x": 60,
        "search_offset_y": 30,
        "needs_white_bg": True,
    },
}


# ============================================================
# HELPERS
# ============================================================

def _decode_signature_image(signature_image_b64: str) -> bytes:
    """Décode la signature canvas (data URL base64) en bytes PNG."""
    if signature_image_b64.startswith("data:image"):
        # Format : data:image/png;base64,iVBORw0KGgo...
        signature_image_b64 = signature_image_b64.split(",", 1)[1]
    return base64.b64decode(signature_image_b64)


def _format_legal_banner(signature: Signature) -> str:
    """Construit le texte du bandeau juridique."""
    signed_at = signature.signed_at or datetime.utcnow()
    date_str = signed_at.strftime("%d/%m/%Y à %H:%M")
    name = signature.signer_name_typed or "—"
    ip = signature.signer_ip or "—"
    hash_short = (signature.hash_sha256 or "")[:16] + "…" if signature.hash_sha256 else "—"
    return (
        f"Signé électroniquement le {date_str} par {name} — "
        f"IP {ip} — SHA-256: {hash_short}"
    )


def _draw_legal_banner_on_all_pages(
    doc: fitz.Document,
    signature: Signature,
) -> None:
    """Dessine le bandeau juridique en bas de toutes les pages."""
    banner_text = _format_legal_banner(signature)
    banner_height = 18  # points (=6mm)
    text_y_offset = 7   # points depuis le bas du bandeau

    for page in doc:
        page_rect = page.rect
        # Bandeau en bas : x=0 sur toute la largeur, y=bottom-banner_height
        banner_rect = fitz.Rect(
            0,
            page_rect.height - banner_height,
            page_rect.width,
            page_rect.height,
        )

        # Fond blanc semi-opaque (pour cacher si chevauchement de texte)
        page.draw_rect(
            banner_rect,
            color=(0.95, 0.95, 0.95),  # gris très clair
            fill=(0.97, 0.97, 0.97),
            overlay=True,
            width=0.3,
        )

        # Texte du bandeau (gris foncé, 7pt)
        text_rect = fitz.Rect(
            10,
            page_rect.height - banner_height + 4,
            page_rect.width - 10,
            page_rect.height - 2,
        )
        page.insert_textbox(
            text_rect,
            banner_text,
            fontsize=7,
            fontname="helv",
            color=(0.25, 0.25, 0.25),
            align=fitz.TEXT_ALIGN_CENTER,
        )


def _insert_signature_image(
    page: fitz.Page,
    image_bytes: bytes,
    zone: Dict[str, Any],
) -> None:
    """Incruste l'image PNG de la signature à la zone définie."""
    # Zone cible
    rect = fitz.Rect(
        zone["x"],
        zone["y"],
        zone["x"] + zone["width"],
        zone["y"] + zone["height"],
    )

    # Si template externe → poser un rect blanc opaque d'abord
    if zone.get("needs_white_bg"):
        page.draw_rect(
            rect,
            color=(1, 1, 1),
            fill=(1, 1, 1),
            overlay=True,
        )

    # Tenter d'utiliser une ancre dynamique
    if zone.get("fallback_search"):
        anchors = page.search_for(zone["fallback_search"])
        if anchors:
            anchor = anchors[0]
            offset_x = zone.get("search_offset_x", 60)
            offset_y = zone.get("search_offset_y", 30)
            rect = fitz.Rect(
                anchor.x0 + offset_x,
                anchor.y0 + offset_y,
                anchor.x0 + offset_x + zone["width"],
                anchor.y0 + offset_y + zone["height"],
            )
            logger.debug(f"  Ancre '{zone['fallback_search']}' trouvée à ({anchor.x0:.0f}, {anchor.y0:.0f})")

    # Insérer l'image
    page.insert_image(rect, stream=image_bytes, overlay=True, keep_proportion=True)


# ============================================================
# FONCTION PRINCIPALE
# ============================================================

def sign_document_pdf(
    document: Document,
    signature: Signature,
) -> Optional[str]:
    """
    Génère le PDF signé pour un document.

    Args:
        document: instance Document avec file_path_unsigned valide
        signature: instance Signature avec signature_image (base64) + métadonnées

    Returns:
        chemin du fichier signed généré, ou None si échec.

    Idempotent : écrase file_path_signed s'il existe déjà.
    """
    if not document.file_path_unsigned:
        logger.warning(f"Document {document.id} : pas de file_path_unsigned, skip")
        return None

    unsigned_path = Path(document.file_path_unsigned)
    if not unsigned_path.exists():
        logger.error(f"Document {document.id} : fichier unsigned introuvable : {unsigned_path}")
        return None

    if not signature.signature_image:
        logger.warning(f"Signature {signature.id} : pas d'image canvas, skip")
        return None

    doc_type = document.type.value if hasattr(document.type, "value") else document.type
    zone = SIGNATURE_ZONES.get(doc_type)
    if not zone:
        logger.warning(f"Type doc {doc_type} : pas de zone signature définie, skip")
        return None

    # Calculer le chemin signed (à côté du unsigned)
    signed_filename = unsigned_path.name.replace("_unsigned", "_signed")
    signed_path = unsigned_path.parent / signed_filename

    try:
        # Ouvrir le PDF unsigned
        pdf_doc = fitz.open(str(unsigned_path))

        # 1. Incruster l'image signature à la bonne zone
        page_index = zone["page"] if zone["page"] >= 0 else len(pdf_doc) + zone["page"]
        page = pdf_doc[page_index]
        image_bytes = _decode_signature_image(signature.signature_image)
        _insert_signature_image(page, image_bytes, zone)

        # 2. Bandeau juridique sur TOUTES les pages
        _draw_legal_banner_on_all_pages(pdf_doc, signature)

        # 3. Sauver
        pdf_doc.save(str(signed_path))
        pdf_doc.close()

        logger.info(f"  ✅ {doc_type} signé → {signed_path.name}")
        return str(signed_path)

    except Exception as e:
        logger.exception(f"Erreur incrustation {doc_type} (doc {document.id}) : {e}")
        return None


def sign_intervention_documents(
    db: Session,
    intervention_id: str,
) -> Dict[str, Any]:
    """
    Incruste les signatures dans tous les documents d'une intervention.

    Usage :
        from services.pdf_signing import sign_intervention_documents
        result = sign_intervention_documents(db, intervention_id)

    Returns:
        dict avec stats : {total, signed, skipped, errors, paths}
    """
    documents = db.query(Document).filter(
        Document.intervention_id == intervention_id
    ).all()

    if not documents:
        return {"total": 0, "signed": 0, "skipped": 0, "errors": 0, "paths": []}

    stats = {"total": len(documents), "signed": 0, "skipped": 0, "errors": 0, "paths": []}

    for doc in documents:
        # Récupérer la signature liée à ce document
        signature = db.query(Signature).filter(
            Signature.document_id == doc.id
        ).first()

        if not signature:
            logger.warning(f"  ⚠️  Pas de signature pour doc {doc.id} ({doc.type})")
            stats["skipped"] += 1
            continue

        signed_path = sign_document_pdf(doc, signature)

        if signed_path:
            doc.file_path_signed = signed_path
            doc.status = DocumentStatus.SIGNED
            stats["signed"] += 1
            stats["paths"].append(signed_path)
        else:
            stats["errors"] += 1

    db.commit()
    logger.info(
        f"Intervention {intervention_id} : {stats['signed']}/{stats['total']} docs signés "
        f"({stats['errors']} erreurs, {stats['skipped']} skip)"
    )
    return stats
