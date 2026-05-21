"""Lance la sync manuellement et trace l'event 02/05."""
import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.google_credentials import GoogleCredentials
from services import google_calendar_service, calendar_event_parser

db = SessionLocal()
cred = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True).first()

# 1. Recupere tous les events (avec defaults)
events = google_calendar_service.list_calendar_events(db, cred)
print(f"\n>>> {len(events)} events ramenes par la sync\n")

# 2. Cherche le 02/05 dedans
found_0205 = []
for ev in events:
    start = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date", "")
    if "2026-05-02" in start:
        found_0205.append(ev)

print(f">>> {len(found_0205)} event(s) au 02/05 dans la liste ramenee\n")

for ev in found_0205:
    print(f"=== {ev.get('summary')} ===")
    print(f"  id : {ev.get('id')}")
    print(f"  start : {ev.get('start')}")
    print(f"  desc len : {len(ev.get('description', '') or '')}")
    
    # 3. Test parsing
    parsed = calendar_event_parser.parse_event(ev)
    if parsed:
        print(f"  PARSING OK -> tel={parsed.get('client_telephone')}, date={parsed.get('date_rdv')}")
    else:
        print(f"  PARSING -> None (skip)")
        # On regarde POURQUOI il skip
        desc = ev.get("description", "") or ""
        print(f"  desc snippet : {desc[:200]!r}")

db.close()
