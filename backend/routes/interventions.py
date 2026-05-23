"""Routes CRUD interventions."""
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from loguru import logger

from database import get_db
from models import User, Intervention, InterventionStatus, Signature, Document
from schemas.signature import SendSignatureRequest, SendSignatureResponse
from services.signature_service import prepare_signature_workflow
from schemas.intervention import (
    InterventionCreate, InterventionUpdate, InterventionResponse,
    InterventionListResponse, InterventionStats
)
from utils.dependencies import get_current_user


router = APIRouter()


@router.post("", response_model=InterventionResponse, status_code=status.HTTP_201_CREATED)
async def create_intervention(
    payload: InterventionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Créer une nouvelle intervention."""
    intervention = Intervention(
        **payload.model_dump(),
        user_id=user.id,
        status=InterventionStatus.PENDING
    )
    db.add(intervention)
    db.commit()
    db.refresh(intervention)
    
    logger.info(f"Intervention créée : {intervention.id} par {user.email}")
    return intervention


@router.get("", response_model=InterventionListResponse)
async def list_interventions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[InterventionStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Recherche dans nom/prénom/téléphone"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Liste paginée des interventions avec filtres."""
    query = db.query(Intervention)
    
    if status_filter:
        query = query.filter(Intervention.status == status_filter)
    
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Intervention.client_nom.ilike(s),
                Intervention.client_prenom.ilike(s),
                Intervention.client_telephone.ilike(s),
            )
        )
    
    if date_from:
        query = query.filter(Intervention.date_rdv >= date_from)
    if date_to:
        query = query.filter(Intervention.date_rdv <= date_to)
    
    total = query.count()
    pages = (total + page_size - 1) // page_size
    
    items = (
        query.order_by(Intervention.date_rdv.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    
    return InterventionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.get("/stats", response_model=InterventionStats)
async def get_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Statistiques des interventions pour le dashboard."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    total = db.query(Intervention).count()
    
    by_status = dict(
        db.query(Intervention.status, func.count(Intervention.id))
        .group_by(Intervention.status)
        .all()
    )
    
    today = db.query(Intervention).filter(Intervention.date_rdv >= today_start).count()
    week = db.query(Intervention).filter(Intervention.date_rdv >= week_start).count()
    month = db.query(Intervention).filter(Intervention.date_rdv >= month_start).count()
    
    return InterventionStats(
        total=total,
        pending=by_status.get(InterventionStatus.PENDING, 0),
        sent=by_status.get(InterventionStatus.SENT, 0),
        signed=by_status.get(InterventionStatus.SIGNED, 0),
        partial=by_status.get(InterventionStatus.PARTIAL, 0),
        expired=by_status.get(InterventionStatus.EXPIRED, 0),
        cancelled=by_status.get(InterventionStatus.CANCELLED, 0),
        today=today,
        week=week,
        month=month,
    )


@router.get("/export-csv")
async def export_csv(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """Exporte toutes les interventions au format CSV (UTF-8 BOM pour Excel).
    
    Colonnes :
    Date RDV, Heure, Client, Telephone, Adresse, CP, Ville,
    N Contrat, N Sinistre, Description, Statut, SMS envoyes, Cree le
    """
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse
    
    query = db.query(Intervention)
    if status_filter and status_filter != "all":
        try:
            query = query.filter(Intervention.status == InterventionStatus(status_filter))
        except ValueError:
            pass
    
    interventions = query.order_by(Intervention.date_rdv.desc()).all()
    
    # Build CSV
    output = StringIO()
    output.write("﻿")  # BOM UTF-8 pour Excel
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    
    writer.writerow([
        "Date RDV", "Heure", "Nom", "Prenom", "Telephone", 
        "Adresse", "Code Postal", "Ville",
        "N Contrat", "N Sinistre", "Description",
        "Statut", "SMS envoyes", "Cree le"
    ])
    
    for intv in interventions:
        date_rdv = intv.date_rdv.strftime("%d/%m/%Y") if intv.date_rdv else ""
        heure_rdv = intv.date_rdv.strftime("%H:%M") if intv.date_rdv else ""
        created_at = intv.created_at.strftime("%d/%m/%Y %H:%M") if intv.created_at else ""
        statut = intv.status.value if intv.status else ""
        
        writer.writerow([
            date_rdv,
            heure_rdv,
            intv.client_nom or "",
            intv.client_prenom or "",
            intv.client_telephone or "",
            intv.client_adresse or "",
            intv.client_code_postal or "",
            intv.client_ville or "",
            intv.numero_contrat or "",
            intv.numero_sinistre or "",
            (intv.description_travaux or "").replace("\n", " ").replace("\r", " ")[:200],
            statut,
            intv.sms_sent_count or 0,
            created_at,
        ])
    
    output.seek(0)
    csv_content = output.getvalue()
    
    from datetime import datetime as _dt
    filename = f"interventions_lbp_{_dt.now().strftime('%Y%m%d_%H%M')}.csv"
    
    logger.info(f"[EXPORT] {len(interventions)} interventions exportees en CSV")
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        }
    )


@router.get("/{intervention_id}", response_model=InterventionResponse)
async def get_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Détail d'une intervention."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention introuvable")
    return intervention


@router.patch("/{intervention_id}", response_model=InterventionResponse)
async def update_intervention(
    intervention_id: UUID,
    payload: InterventionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Mettre à jour une intervention (champs partiels)."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention introuvable")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(intervention, key, value)
    
    intervention.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(intervention)
    
    logger.info(f"Intervention modifiée : {intervention.id} par {user.email}")
    return intervention


@router.delete("/{intervention_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Supprimer une intervention (cascade sur documents et signatures)."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention introuvable")
    
    db.delete(intervention)
    db.commit()
    
    logger.info(f"Intervention supprimée : {intervention_id} par {user.email}")
    return None


@router.post("/{intervention_id}/send-signature", response_model=SendSignatureResponse)
async def send_for_signature(
    intervention_id: UUID,
    payload: SendSignatureRequest = SendSignatureRequest(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Déclenche le workflow signature :
    - Génère un token unique
    - Crée les entrées Document (PV, Attestation TVA, Fiche travaux)
    - Passe le statut à 'sent'
    - Retourne le token + URL pour SMS
    
    À ce stade, les PDFs ne sont PAS encore générés (étape suivante).
    Les fichiers seront créés au moment où le client ouvre la page de signature.
    """
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention introuvable")
    
    # Vérifier que l'intervention est dans un statut valide
    if intervention.status == InterventionStatus.CANCELLED:
        raise HTTPException(
            status_code=400,
            detail="Cette intervention est annulée"
        )
    if intervention.status == InterventionStatus.SIGNED:
        raise HTTPException(
            status_code=400,
            detail="Cette intervention est déjà entièrement signée"
        )
    
    # Lancer le workflow
    result = prepare_signature_workflow(
        db=db,
        intervention=intervention,
        provider=payload.provider,
        document_types=payload.document_types,
        expires_in_days=payload.expires_in_days,
    )
    
    logger.info(
        f"📨 Signature envoyée par {user.email} pour intervention {intervention_id} "
        f"({result['documents_generated']} docs, provider={payload.provider})"
    )
    
    return SendSignatureResponse(**result)




@router.post("/send-batch-reminders")
async def send_batch_reminders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Envoie en lot les SMS de rappel J-1 a toutes les interventions du lendemain.
    
    Applique les memes filtres que le job auto (heure 19h) :
    - Exclude VIAREN, AWP, PARTICULIER, HS, HOMSERVE
    - Skip si sms_sent_count == 0 (SMS initial pas envoye)
    - Skip si client_nom = code postal (event mal identifie)
    - Skip si rappel deja envoye dans les 12 dernieres heures
    
    Retourne un compte rendu detaille.
    """
    import re as _re
    from models.setting import Setting
    from models.sms_log import SmsType
    from services.sms_service import send_sms_twilio
    from services.scheduler_service import _format_template, _fetch_setting
    
    # Fenetre demain
    tomorrow_start = (datetime.utcnow() + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow_start + timedelta(days=1)
    
    interventions = db.query(Intervention).filter(
        Intervention.date_rdv >= tomorrow_start,
        Intervention.date_rdv < tomorrow_end,
        Intervention.sms_sent_count > 0,
        Intervention.status != InterventionStatus.CANCELLED,
    ).all()
    
    # Settings
    template = _fetch_setting("sms.template_rappel_j1") or \
        "Rappel : intervention LBP demain {date} a {heure} chez vous."
    exclude_raw = _fetch_setting("relance.rappel_j1_exclude_keywords") or "VIAREN,AWP,PARTICULIER,HS,HOMSERVE"
    exclude_keywords = [k.strip().upper() for k in exclude_raw.split(",") if k.strip()]
    
    stats = {
        "total_tomorrow": len(interventions),
        "sent": 0,
        "skipped_excluded": 0,
        "skipped_no_phone": 0,
        "skipped_bad_name": 0,
        "skipped_recent_reminder": 0,
        "errors": 0,
        "details": [],
    }
    
    for intv in interventions:
        # Anti-rebond 12h
        if intv.last_reminder_at and (datetime.utcnow() - intv.last_reminder_at).total_seconds() < 12 * 3600:
            stats["skipped_recent_reminder"] += 1
            continue
        
        if not intv.client_telephone:
            stats["skipped_no_phone"] += 1
            continue
        
        # Skip si nom = code postal
        if not intv.client_nom or _re.match(r"^[0-9]{4,5}$", intv.client_nom.strip()):
            stats["skipped_bad_name"] += 1
            continue
        
        # Exclusions Kevin
        search_text = " ".join([
            (intv.description_calendar_raw or ""),
            (intv.description_travaux or ""),
        ]).upper()
        matched = next((k for k in exclude_keywords if k in search_text), None)
        if matched:
            stats["skipped_excluded"] += 1
            stats["details"].append({
                "intervention_id": str(intv.id),
                "client_nom": intv.client_nom,
                "action": "skipped",
                "reason": f"exclusion '{matched}'",
            })
            continue
        
        # Envoi SMS
        msg = _format_template(template, intv)
        try:
            send_sms_twilio(
                to_number=intv.client_telephone,
                message=msg,
                intervention_id=str(intv.id),
                sms_type=SmsType.RDV_RAPPEL,
                db=db,
            )
            intv.last_reminder_at = datetime.utcnow()
            intv.reminder_count = (intv.reminder_count or 0) + 1
            db.commit()
            stats["sent"] += 1
            stats["details"].append({
                "intervention_id": str(intv.id),
                "client_nom": intv.client_nom,
                "action": "sent",
                "phone": intv.client_telephone,
            })
        except Exception as e:
            stats["errors"] += 1
            stats["details"].append({
                "intervention_id": str(intv.id),
                "client_nom": intv.client_nom,
                "action": "error",
                "error": str(e),
            })
            logger.error(f"[BATCH] Erreur envoi rappel {intv.id} : {e}")
    
    logger.info(f"[BATCH] send-batch-reminders : {stats['sent']}/{stats['total_tomorrow']} envoyes, {stats['skipped_excluded']} exclus")
    return stats


@router.get("/{intervention_id}/signatures")
def get_intervention_signatures(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les signatures d'une intervention avec preuves juridiques."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    signatures = db.query(Signature).filter(
        Signature.intervention_id == intervention_id
    ).all()

    documents = db.query(Document).filter(
        Document.intervention_id == intervention_id
    ).all()

    docs_map = {str(d.id): d.type.value for d in documents}

    return {
        "intervention_id": str(intervention_id),
        "is_signed": intervention.status.value == "signed",
        "signatures": [
            {
                "id": str(s.id),
                "document_id": str(s.document_id),
                "document_type": docs_map.get(str(s.document_id), "?"),
                "status": s.status.value,
                "signed_at": s.signed_at.isoformat() if s.signed_at else None,
                "signer_ip": s.signer_ip,
                "signer_user_agent": s.signer_user_agent,
                "signer_name_typed": s.signer_name_typed,
                "signer_consent_text": s.signer_consent_text,
                "hash_sha256": s.hash_sha256,
                "signature_image": s.signature_image,
                "provider": s.provider,
            }
            for s in signatures
        ],
        "documents": [
            {
                "id": str(d.id),
                "type": d.type.value,
                "status": d.status.value,
                "signed_at": d.signed_at.isoformat() if d.signed_at else None,
            }
            for d in documents
        ],
    }
