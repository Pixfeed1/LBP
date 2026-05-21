import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.intervention import Intervention
from services.pdf_generation import intervention_to_client_data  # SANS underscore
from services.proces_verbal_generator import generate_proces_verbal_pdf, _parse_pacifica_refs

db = SessionLocal()
# Cherche une intervention qui a Pacifica/Allianz dans la description_calendar_raw
intv = db.query(Intervention).filter(
    (Intervention.description_calendar_raw.ilike('%PACIFICA%')) |
    (Intervention.description_calendar_raw.ilike('%ALLIANZ%'))
).first()

if not intv:
    # Fallback : prendre n'importe quelle intervention Calendar
    intv = db.query(Intervention).filter(Intervention.google_event_id.isnot(None)).first()

print(f"Intervention test : {intv.client_nom} {intv.client_prenom}")
print(f"  date_rdv : {intv.date_rdv}")
print(f"  ville : {intv.client_ville}")
print()

raw = intv.description_calendar_raw or ""
print(f"  description_calendar_raw (300 car) :")
print(f"    >>> {raw[:300]!r}")
print()

refs = _parse_pacifica_refs(raw)
print(f"  Refs Pacifica parsees :")
print(f"    Numero sinistre : {refs['numero_sinistre']!r}")
print(f"    Cie assurance   : {refs['cie_assurance']!r}")
print(f"    Franchise       : {refs['franchise']!r}")
print()

client_data = intervention_to_client_data(intv)
print(f"  client_data envoye au PV (cles) : {list(client_data.keys())}")

generate_proces_verbal_pdf(client_data, "/tmp/test_pv_pacifica.pdf")
print("\nPV genere : /tmp/test_pv_pacifica.pdf")
db.close()
