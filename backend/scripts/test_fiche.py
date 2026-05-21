"""Test Fiche Travaux apres retrait PACIFICA."""
import sys
sys.path.insert(0, '/app')
from services.pdf_filler import fill_fiche_travaux
import os

client_data = {
    "nom": "DUPONT",
    "prenom": "Jean",
    "adresse": "12 rue de la Paix",
    "code_postal": "75001",
    "ville": "Paris",
    "date_rdv": "15/05/2026",
    "description_travaux": "Remplacement chaudiere",
    "montant_ht": "1500,00",
    "montant_tva": "300,00",
    "montant_ttc": "1800,00",
}

template = "/app/pdf_templates/fiche_travaux.pdf"
output = "/tmp/test_fiche.pdf"

fill_fiche_travaux(template, client_data, output)
print(f"OK Fiche generee : {output} ({os.path.getsize(output)} octets)")
