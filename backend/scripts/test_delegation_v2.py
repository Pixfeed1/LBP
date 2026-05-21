"""Test du nouveau generateur Delegation LBP."""
import sys
sys.path.insert(0, '/app')
from services.delegation_paiement_generator import generate_delegation_pdf

client_data = {
    "reference_intervention": "LBP-A1B2C3D4",
    "nom": "DUPONT",
    "prenom": "Jean",
    "adresse": "12 rue de la Paix",
    "code_postal": "75001",
    "ville": "Paris",
    "date_rdv": "15/05/2026",
    "montant_ht": "1 500,00",
    "montant_tva": "300,00",
    "montant_ttc": "1 800,00",
}

generate_delegation_pdf(client_data, "/tmp/test_delegation_v2.pdf")
print("OK")
