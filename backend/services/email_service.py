"""Service d'envoi d'emails via SMTP (aiosmtplib).

Workflow d'envoi du PDF signe au client :
1. Le client signe sur la page publique avec son email
2. Une fois tous les docs signes, on appelle send_signed_pdf_email()
3. Le service envoie un email HTML avec les PDFs signes en piece jointe
"""

import os
import smtplib
from pathlib import Path
from email.message import EmailMessage
from email.utils import formataddr
from typing import List, Optional
from datetime import datetime
from loguru import logger

from config import settings
from database import SessionLocal
from models.intervention import Intervention
from models.document import Document
from models.email_log import EmailLog


def is_configured() -> bool:
    """Verifie que les creds SMTP sont en place."""
    return all([
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        settings.SMTP_USER,
        settings.SMTP_PASSWORD,
    ])


def _build_html_body(intervention: Intervention) -> str:
    """Genere le corps HTML de l'email."""
    nom = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip() or "Client"
    date_rdv = intervention.date_rdv.strftime("%d/%m/%Y") if intervention.date_rdv else ""

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 0; }}
.header {{ background: #0073e6; color: white; padding: 24px 32px; }}
.header h1 {{ margin: 0; font-size: 22px; font-weight: 600; }}
.content {{ padding: 32px; background: #ffffff; }}
.content p {{ margin: 0 0 16px 0; }}
.docs-box {{ background: #f5f7fa; border-left: 3px solid #0073e6; padding: 16px 20px; margin: 24px 0; border-radius: 4px; }}
.docs-box ul {{ margin: 8px 0 0 0; padding: 0 0 0 20px; }}
.docs-box li {{ margin: 4px 0; }}
.footer {{ padding: 20px 32px; text-align: center; color: #6b7280; font-size: 13px; background: #fafafa; border-top: 1px solid #e5e7eb; }}
.footer a {{ color: #0073e6; text-decoration: none; }}
</style>
</head>
<body>
  <div class="header">
    <h1>Vos documents signes - Les Bons Plombiers</h1>
  </div>
  <div class="content">
    <p>Bonjour {nom},</p>
    <p>Vous trouverez en piece jointe les documents que vous avez signes electroniquement{f' suite a notre intervention du {date_rdv}' if date_rdv else ''}.</p>
    <div class="docs-box">
      <strong>Documents joints :</strong>
      <ul>
        <li>Proces-verbal de reception</li>
        <li>Fiche de travaux</li>
        <li>Attestation TVA (si logement de plus de 2 ans)</li>
      </ul>
    </div>
    <p>Conservez precieusement ces documents, ils ont valeur legale.</p>
    <p>Pour toute question, n'hesitez pas a nous contacter.</p>
    <p>Cordialement,<br><strong>L'equipe Les Bons Plombiers</strong></p>
  </div>
  <div class="footer">
    Les Bons Plombiers - <a href="https://lesbonsplombiers.fr">lesbonsplombiers.fr</a><br>
    Email envoye automatiquement, merci de ne pas y repondre directement.
  </div>
</body>
</html>"""


def send_signed_pdf_email(
    to_email: str,
    intervention: Intervention,
    documents: List[Document],
) -> dict:
    """Envoie le mail avec les PDFs signes en piece jointe.

    Returns:
        dict avec keys 'success' (bool), 'error' (str si echec)
    """
    if not is_configured():
        logger.warning("[EMAIL] Service non configure (vars SMTP manquantes)")
        return {"success": False, "error": "SMTP non configure"}

    if not to_email:
        return {"success": False, "error": "Email destinataire manquant"}

    nom = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip() or "Client"
    subject = f"Vos documents signes - Les Bons Plombiers"

    # Construire le message
    msg = EmailMessage()
    msg["From"] = formataddr((settings.SMTP_FROM_NAME or "Les Bons Plombiers", settings.SMTP_FROM_EMAIL or settings.SMTP_USER))
    msg["To"] = to_email
    msg["Subject"] = subject

    # Plain text fallback
    msg.set_content(f"""Bonjour {nom},

Vous trouverez en piece jointe les documents signes electroniquement.

Conservez precieusement ces documents, ils ont valeur legale.

Cordialement,
L'equipe Les Bons Plombiers
""")

    # HTML version
    msg.add_alternative(_build_html_body(intervention), subtype="html")

    # Attacher les PDFs signes
    attached_count = 0
    for doc in documents:
        # On prefere le PDF signe, sinon l'unsigned
        pdf_path = doc.file_path_signed or doc.file_path_unsigned
        if not pdf_path or not os.path.exists(pdf_path):
            logger.warning(f"[EMAIL] PDF introuvable pour doc {doc.id} : {pdf_path}")
            continue

        with open(pdf_path, "rb") as f:
            pdf_data = f.read()

        # Nom propre du fichier
        type_label = {
            "proces_verbal": "Proces-verbal",
            "fiche_travaux": "Fiche-travaux",
            "attestation_tva": "Attestation-TVA",
            "delegation_paiement": "Delegation-paiement",
        }.get(doc.type.value if hasattr(doc.type, 'value') else str(doc.type), "Document")
        filename = f"{type_label}-{intervention.client_nom or 'client'}.pdf"

        msg.add_attachment(
            pdf_data,
            maintype="application",
            subtype="pdf",
            filename=filename,
        )
        attached_count += 1

    if attached_count == 0:
        return {"success": False, "error": "Aucun PDF a joindre"}

    # Envoi via SMTP synchrone (smtplib, plus simple et fiable que aiosmtplib pour l'instant)
    db = SessionLocal()
    try:
        log = EmailLog(
            intervention_id=intervention.id,
            recipient=to_email,
            subject=subject,
            status="pending",
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)

        log.status = "sent"
        db.commit()
        logger.info(f"[EMAIL] Mail envoye a {to_email} ({attached_count} PDFs joints)")
        return {"success": True, "log_id": str(log.id), "attached_count": attached_count}

    except Exception as e:
        logger.error(f"[EMAIL] Echec envoi a {to_email} : {e}")
        try:
            log.status = "failed"
            log.error_message = str(e)[:500]
            db.commit()
        except Exception:
            pass
        return {"success": False, "error": str(e)}
    finally:
        db.close()
