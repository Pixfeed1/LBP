"""
Service Yousign pour signature electronique avec preuves eIDAS.

Workflow :
1. create_signature_request() : cree la signature request Yousign
2. upload_document() : upload chaque PDF
3. add_signer() : ajoute le client comme signataire
4. activate() : active la request (envoi possible des SMS Yousign)
5. get_signature_link() : retourne l'URL signature.yousign.app/...

Le webhook Yousign nous notifie quand le client signe, on telecharge alors
les PDFs signes et on les sauve dans storage/documents/{intervention_id}/.
"""
import os
import requests
from typing import Optional, List
from loguru import logger
from models.intervention import Intervention
from models.document import Document


def _get_config():
    """Recupere config Yousign depuis env vars."""
    return {
        "base_url": os.getenv("YOUSIGN_BASE_URL", "https://api-sandbox.yousign.app/v3").rstrip("/"),
        "api_key": os.getenv("YOUSIGN_API_KEY", "").strip(),
    }


def _headers(json_content=False):
    cfg = _get_config()
    h = {"Authorization": f"Bearer {cfg['api_key']}", "Accept": "application/json"}
    if json_content:
        h["Content-Type"] = "application/json"
    return h


def is_configured() -> bool:
    """Verifie que les creds Yousign sont en place."""
    cfg = _get_config()
    return bool(cfg["api_key"]) and bool(cfg["base_url"])


def create_signature_request(intervention: Intervention) -> dict:
    """Cree une signature request Yousign pour une intervention."""
    cfg = _get_config()

    nom = intervention.client_nom or "Client"
    prenom = intervention.client_prenom or ""

    payload = {
        "name": f"Signature LBP - {nom} {prenom} - {intervention.id}",
        "delivery_mode": "none",  # On envoie le SMS nous-meme via Twilio
        "timezone": "Europe/Paris",
        "ordered_signers": False,
        "external_id": str(intervention.id),
    }

    logger.info(f"[YOUSIGN] Creation signature request pour {nom} {prenom}...")
    resp = requests.post(
        f"{cfg['base_url']}/signature_requests",
        headers=_headers(json_content=True),
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    sr = resp.json()
    logger.info(f"[YOUSIGN] Signature request creee : {sr['id']}")
    return sr


def upload_document(signature_request_id: str, pdf_path: str, name: str) -> Optional[dict]:
    """Upload un PDF dans une signature request."""
    cfg = _get_config()

    if not os.path.exists(pdf_path):
        logger.error(f"[YOUSIGN] Fichier introuvable : {pdf_path}")
        return None

    logger.info(f"[YOUSIGN] Upload document : {name}")
    with open(pdf_path, "rb") as f:
        resp = requests.post(
            f"{cfg['base_url']}/signature_requests/{signature_request_id}/documents",
            headers={"Authorization": f"Bearer {cfg['api_key']}"},
            files={"file": (os.path.basename(pdf_path), f, "application/pdf")},
            data={"nature": "signable_document", "parse_anchors": "true"},
            timeout=30,
        )
    resp.raise_for_status()
    doc = resp.json()
    logger.info(f"[YOUSIGN] Document uploade : {doc['id']}")
    return doc


def add_signer(signature_request_id: str, intervention: Intervention, document_ids: List[str]) -> dict:
    """Ajoute le client comme signataire."""
    cfg = _get_config()

    nom = intervention.client_nom or "Inconnu"
    prenom = intervention.client_prenom or "Client"
    email = intervention.client_email or "signature@lesbonsplombiers.com"
    telephone = intervention.client_telephone or ""

    payload = {
        "info": {
            "first_name": prenom,
            "last_name": nom,
            "email": email,
            "phone_number": telephone,
            "locale": "fr",
        },
        "signature_level": "electronic_signature",
        "signature_authentication_mode": "no_otp",
    }

    logger.info(f"[YOUSIGN] Ajout signataire : {prenom} {nom}")
    resp = requests.post(
        f"{cfg['base_url']}/signature_requests/{signature_request_id}/signers",
        headers=_headers(json_content=True),
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    signer = resp.json()
    logger.info(f"[YOUSIGN] Signataire ajoute : {signer['id']}")
    return signer


def activate(signature_request_id: str) -> dict:
    """Active la signature request (necessaire avant de pouvoir recuperer le lien)."""
    cfg = _get_config()

    logger.info(f"[YOUSIGN] Activation signature request {signature_request_id}")
    resp = requests.post(
        f"{cfg['base_url']}/signature_requests/{signature_request_id}/activate",
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    sr = resp.json()
    logger.info(f"[YOUSIGN] Activee, status: {sr.get('status')}")
    return sr


def get_signature_link(signature_request_id: str, signer_id: str) -> Optional[str]:
    """Recupere le lien de signature pour un signer."""
    cfg = _get_config()

    resp = requests.get(
        f"{cfg['base_url']}/signature_requests/{signature_request_id}/signers/{signer_id}",
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    signer = resp.json()
    link = signer.get("signature_link")
    logger.info(f"[YOUSIGN] Lien signature obtenu pour signer {signer_id}")
    return link


def download_signed_pdf(signature_request_id: str, document_id: str) -> bytes:
    """Telecharge le PDF signe d'un document apres signature."""
    cfg = _get_config()

    resp = requests.get(
        f"{cfg['base_url']}/signature_requests/{signature_request_id}/documents/{document_id}/download",
        headers={"Authorization": f"Bearer {cfg['api_key']}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.content


# ============================================================
# Workflow complet : prepare la signature Yousign de bout en bout
# ============================================================

def prepare_yousign_signature(intervention: Intervention, documents: List[Document]) -> dict:
    """
    Workflow complet Yousign pour une intervention :
    1. Cree la signature request
    2. Upload tous les PDFs
    3. Ajoute le signataire
    4. Active
    5. Retourne URL signature

    Returns:
        {
          "yousign_signature_request_id": str,
          "yousign_signer_id": str,
          "signature_url": str,
          "yousign_document_ids": dict {doc_id_db: yousign_doc_id}
        }
    """
    if not is_configured():
        raise ValueError("Yousign non configure. Renseignez YOUSIGN_API_KEY et YOUSIGN_BASE_URL.")

    # 1. Create signature request
    sr = create_signature_request(intervention)
    sr_id = sr["id"]

    # 2. Upload tous les PDFs
    yousign_doc_map = {}  # {document.id (DB): yousign_document_id}
    for doc in documents:
        if not doc.file_path_unsigned or not os.path.exists(doc.file_path_unsigned):
            logger.warning(f"[YOUSIGN] Skip doc {doc.id}, PDF introuvable : {doc.file_path_unsigned}")
            continue
        yousign_doc = upload_document(sr_id, doc.file_path_unsigned, doc.type.value)
        if yousign_doc:
            yousign_doc_map[str(doc.id)] = yousign_doc["id"]

    if not yousign_doc_map:
        raise ValueError("Aucun document n'a pu etre uploade chez Yousign")

    # 3. Add signer
    document_ids = list(yousign_doc_map.values())
    signer = add_signer(sr_id, intervention, document_ids)
    signer_id = signer["id"]

    # 4. Activate
    activate(sr_id)

    # 5. Get signature link
    signature_url = get_signature_link(sr_id, signer_id)

    return {
        "yousign_signature_request_id": sr_id,
        "yousign_signer_id": signer_id,
        "signature_url": signature_url,
        "yousign_document_ids": yousign_doc_map,
    }
