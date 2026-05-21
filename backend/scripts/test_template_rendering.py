"""Test de rendu d'un SMS avec une intervention existante."""
import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.intervention import Intervention
from services.scheduler_service import _format_template, _fetch_setting

db = SessionLocal()
intv = db.query(Intervention).filter(Intervention.google_event_id.isnot(None)).first()

if not intv:
    print("Aucune intervention Calendar trouvee")
    sys.exit(0)

print(f"Intervention test : {intv.client_nom} {intv.client_prenom} - {intv.date_rdv}")
print(f"Description : {(intv.description_travaux or '')[:200]!r}")
print()

# Render template rappel J-1
template = _fetch_setting("sms.template_rappel_j1")
rendered = _format_template(template, intv, signature_token="DEMO123TOKEN")

print("=" * 60)
print("RENDU FINAL DU SMS DE RAPPEL :")
print("=" * 60)
print(rendered)
print("=" * 60)
print()
print(f"Longueur : {len(rendered)} caracteres ({(len(rendered) // 160) + 1} SMS)")

# Check qu'il n'y a plus de {var} non substituee
import re
remaining = re.findall(r'\{[a-z_]+\}', rendered)
if remaining:
    print(f"\nVARIABLES NON SUBSTITUEES : {remaining}")
else:
    print("\nOK : toutes les variables substituees")

db.close()
