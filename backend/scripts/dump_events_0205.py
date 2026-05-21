"""Affiche tous les events Google Calendar du 02/05/2026."""
import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.google_credentials import GoogleCredentials
from services.google_calendar_service import list_calendar_events

db = SessionLocal()
cred = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True).first()

if not cred:
    print("Aucun calendar connecte")
    sys.exit(1)

events = list_calendar_events(db, cred, days_ahead=60, days_behind=60)
print(f"Total events scannes : {len(events)}\n")
print("=" * 70)

found = 0
for ev in events:
    start_dt = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date", "")
    if "2026-05-02" in start_dt:
        found += 1
        print(f"\n>>> EVENT #{found}")
        print(f"  Date     : {start_dt}")
        print(f"  Titre    : {ev.get('summary', '(sans titre)')}")
        print(f"  Lieu     : {ev.get('location', '(pas de lieu)')}")
        desc = ev.get("description", "") or ""
        print(f"  Desc     : ({len(desc)} caracteres)")
        if desc:
            for line in desc.split("\n"):
                print(f"             | {line}")
        else:
            print(f"             | (description vide)")

if found == 0:
    print("\nAUCUN event trouve au 02/05/2026")
    print("\n10 plus anciens events lus (pour info) :")
    sorted_evs = sorted(
        events, 
        key=lambda e: e.get("start", {}).get("dateTime", e.get("start", {}).get("date", ""))
    )[:10]
    for ev in sorted_evs:
        start = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date", "")
        print(f"  {start} | {ev.get('summary', '')[:50]}")
print("=" * 70)
db.close()
