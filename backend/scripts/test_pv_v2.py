import sys
sys.path.insert(0, '/app')
from services.proces_verbal_generator import generate_proces_verbal_pdf

client_data = {
    "nom": "BRASSELEUR",
    "prenom": "KEVIN",
    "adresse": "12 rue de la Paix",
    "code_postal": "75001",
    "ville": "Paris",
    "date_rdv": "21/05/2026",
    "description_travaux": "Remplacement de chaudiere - test description",
    "logement_plus_2_ans": "Y",
}

generate_proces_verbal_pdf(client_data, "/tmp/test_pv_v2.pdf")
print("PV genere : /tmp/test_pv_v2.pdf")
