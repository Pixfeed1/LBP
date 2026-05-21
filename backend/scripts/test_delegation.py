"""Test de generation d'un PDF Delegation."""
import sys
sys.path.insert(0, '/app')
from services.pdf_filler import fill_delegation_paiement
import os

client_data = {
    "nom": "DUPONT",
    "prenom": "Jean",
    "adresse": "12 rue de la Paix",
    "code_postal": "75001",
    "ville": "Paris",
    "date_rdv": "15/05/2026",
}

template = "/app/pdf_templates/delegation_paiement.pdf"
output = "/tmp/test_delegation.pdf"

print(f"Template existe : {os.path.exists(template)}")
print(f"Template taille : {os.path.getsize(template)} octets")

fill_delegation_paiement(template, client_data, output)

size = os.path.getsize(output)
print(f"OK PDF genere : {output} ({size} octets)")
