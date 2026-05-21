import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from models.intervention import Intervention
from services.pdf_generation import intervention_to_client_data, TEMPLATES_DIR
from services.pdf_filler import fill_attestation_tva

db = SessionLocal()
intv = db.query(Intervention).filter(
    Intervention.client_code_postal.isnot(None),
    Intervention.client_code_postal != '',
    Intervention.client_nom.op('~')('[A-Z]{3,}'),  # vrai nom (lettres)
).first()

if not intv:
    print("Aucune intervention avec cp + vrai nom trouvee")
    sys.exit(1)

print(f"Test TVA sur : {intv.client_nom} {intv.client_prenom}")
print(f"  cp = {intv.client_code_postal!r}")
print(f"  ville = {intv.client_ville!r}")
print(f"  adresse = {intv.client_adresse!r}")

client_data = intervention_to_client_data(intv)
template = TEMPLATES_DIR / "attestation_tva.pdf"
print(f"  template = {template}")

fill_attestation_tva(str(template), client_data, "/tmp/test_tva.pdf")
print("TVA genere : /tmp/test_tva.pdf")
