"""Routes pour la gestion et le téléchargement des documents."""
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User, Document
from utils.dependencies import get_current_user


router = APIRouter()


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Télécharger un PDF (signé ou non selon disponibilité)."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document introuvable")
    
    # Privilégier le PDF signé s'il existe
    file_path = document.file_path_signed or document.file_path_unsigned
    if not file_path:
        raise HTTPException(status_code=404, detail="Fichier non généré")
    
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Fichier introuvable sur le disque : {file_path}"
        )
    
    # Nom du fichier de téléchargement
    filename = f"{document.type.value}_{document.intervention_id}.pdf"
    
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/by-intervention/{intervention_id}")
async def list_documents_by_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Liste les documents d'une intervention."""
    docs = db.query(Document).filter(Document.intervention_id == intervention_id).all()
    return [
        {
            "id": str(d.id),
            "type": d.type.value,
            "status": d.status.value,
            "signature_provider": d.signature_provider,
            "file_path_unsigned": d.file_path_unsigned,
            "file_path_signed": d.file_path_signed,
            "has_unsigned_file": bool(d.file_path_unsigned and Path(d.file_path_unsigned).exists()),
            "has_signed_file": bool(d.file_path_signed and Path(d.file_path_signed).exists()),
            "created_at": d.created_at.isoformat(),
            "signed_at": d.signed_at.isoformat() if d.signed_at else None,
        }
        for d in docs
    ]
