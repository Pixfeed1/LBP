"""Re-parser les interventions existantes pour corriger nom/prenom."""
import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.intervention import Intervention
from services.calendar_event_parser import PATTERNS, _extract_first

db = SessionLocal()
interventions = db.query(Intervention).filter(Intervention.google_event_id.isnot(None)).all()

updated = 0
for intv in interventions:
    # On utilise le champ description_travaux qui contient la description Calendar
    desc = intv.description_travaux or ""
    nom_from_desc = _extract_first(PATTERNS.get("nom_complet", []), desc)
    
    if nom_from_desc:
        nom_parts = nom_from_desc.strip().split()
        if len(nom_parts) >= 2:
            new_nom = nom_parts[0]
            new_prenom = " ".join(nom_parts[1:])
        else:
            new_nom = nom_from_desc.strip()
            new_prenom = ""
        
        # Update seulement si different
        if intv.client_nom != new_nom or intv.client_prenom != new_prenom:
            print(f"  {intv.client_nom} {intv.client_prenom} -> {new_nom} {new_prenom}")
            intv.client_nom = new_nom
            intv.client_prenom = new_prenom
            updated += 1

db.commit()
print(f"\nOK : {updated} interventions mises a jour sur {len(interventions)}")
db.close()
