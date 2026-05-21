"""Verifier combien de NOM le parser trouve dans la description Google brute."""
import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.intervention import Intervention
from models.google_credentials import GoogleCredentials
from services.google_calendar_service import list_calendar_events
from services.calendar_event_parser import PATTERNS, _extract_first

db = SessionLocal()
cred = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True).first()

if not cred:
    print("Pas de credentials actives")
    sys.exit(1)

# Recupere tous les events de la fenetre
events = list_calendar_events(db, cred, days_ahead=60, days_behind=60)
print(f"\n{len(events)} events Google ramenes\n")

# Liste les google_event_id des 238 SANS NOM en base
no_name_intvs = db.query(Intervention).filter(
    Intervention.google_event_id.isnot(None),
    ~Intervention.description_travaux.ilike('%NOM%')
).all()
no_name_ids = {i.google_event_id for i in no_name_intvs}
print(f"{len(no_name_ids)} interventions en base sans NOM\n")

# Pour chacune, regarder dans la description Google brute
found_in_google = 0
sample = []
for ev in events:
    if ev.get("id") in no_name_ids:
        desc = ev.get("description", "") or ""
        nom = _extract_first(PATTERNS.get("nom_complet", []), desc)
        if nom:
            found_in_google += 1
            if len(sample) < 5:
                sample.append((ev.get("summary", ""), nom))

print(f"=== {found_in_google} / {len(no_name_ids)} ont un NOM dans la description Google brute ===\n")
print("Exemples :")
for titre, nom in sample:
    print(f"  '{titre[:50]}' -> NOM: {nom}")

db.close()
