"""Debug : récupère les events Google bruts et tente le parsing un par un."""
import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.google_credentials import GoogleCredentials
from services.google_calendar_service import list_events_for_credentials
from services.calendar_event_parser import parse_event
from datetime import datetime, timedelta, timezone

db = SessionLocal()
all_creds = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True).all()

print(f"\n>>> {len(all_creds)} credential(s) actif(s) en base\n")

if not all_creds:
    print("AUCUN UTILISATEUR ACTIF — c'est ça le problème")
    print("Vérifie que is_active = TRUE dans google_credentials pour Kevin")
    sys.exit(0)

for cred in all_creds:
    print(f"=== User : {cred.google_email} ===")
    print(f"  - is_active : {cred.is_active}")
    print(f"  - last_sync_at : {cred.last_sync_at}")
    print(f"  - access_token : {'OUI' if cred.access_token else 'NON'}")
    print(f"  - refresh_token : {'OUI' if cred.refresh_token else 'NON'}")

    # Récupère les events sur les 30 derniers jours + 30 jours à venir
    time_min = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    time_max = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    try:
        events = list_events_for_credentials(cred, time_min=time_min, time_max=time_max)
        print(f"  - {len(events)} event(s) récupéré(s) depuis Google\n")

        for i, ev in enumerate(events[:10]):  # max 10 pour pas spammer
            summary = ev.get("summary", "(sans titre)")
            start = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date")
            desc = ev.get("description", "")
            print(f"  [{i+1}] {start} | {summary}")
            print(f"      Description : {desc[:200]!r}")

            try:
                parsed = parse_event(ev)
                print(f"      Parsing : OK -> {list(parsed.keys())}")
                print(f"      Données extraites : {parsed}")
            except Exception as pe:
                print(f"      Parsing ECHEC : {pe}")
            print()
    except Exception as e:
        print(f"  ERREUR Google API : {e}")
        import traceback
        traceback.print_exc()

db.close()
