"""Liste tous les calendars Google accessibles, et leurs IDs."""
import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.google_credentials import GoogleCredentials
from services.google_calendar_service import _build_credentials
from googleapiclient.discovery import build

db = SessionLocal()
cred = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True).first()

if not cred:
    print("Aucun calendar actif")
    sys.exit(1)

creds = _build_credentials(cred, db)
service = build("calendar", "v3", credentials=creds, cache_discovery=False)

result = service.calendarList().list().execute()
calendars = result.get("items", [])

print(f"\n=== {len(calendars)} calendar(s) accessible(s) pour {cred.google_email} ===\n")
for cal in calendars:
    is_primary = "  [PRIMARY]" if cal.get("primary") else ""
    selected = "X" if cal.get("selected") else " "
    print(f"  [{selected}] {cal.get('summary', '?')}{is_primary}")
    print(f"      id    : {cal.get('id', '?')}")
    print(f"      role  : {cal.get('accessRole', '?')}")
    print(f"      color : {cal.get('backgroundColor', '')}")
    print()

# Pour chaque calendar, compter rapidement les events au 02/05
print("=" * 70)
print("RECHERCHE des events au 2026-05-02 dans CHAQUE calendar :")
print("=" * 70)
from datetime import datetime, timedelta

for cal in calendars:
    cal_id = cal.get("id")
    cal_name = cal.get("summary", "?")
    try:
        evs = service.events().list(
            calendarId=cal_id,
            timeMin="2026-05-01T00:00:00Z",
            timeMax="2026-05-03T00:00:00Z",
            singleEvents=True,
            maxResults=20,
        ).execute()
        items = evs.get("items", [])
        if items:
            print(f"\n>>> {cal_name} ({len(items)} event(s) au 02/05) :")
            for ev in items:
                start = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date", "")
                summary = ev.get("summary", "(sans titre)")
                desc = (ev.get("description", "") or "")[:80]
                print(f"      {start} | {summary}")
                if desc:
                    print(f"        desc: {desc!r}")
        else:
            print(f"  {cal_name} : 0 event au 02/05")
    except Exception as e:
        print(f"  {cal_name} : ERREUR ({e})")

db.close()
