"""Test PV apres nettoyage Pacifica."""
import sys
sys.path.insert(0, '/app')
from services.pdf_filler import fill_proces_verbal
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
    # Pas de sinistre, ni reference_ma -> doit donner un PV vide sur ces champs
}

template = "/app/pdf_templates/proces_verbal.pdf"
output = "/tmp/test_pv.pdf"

fill_proces_verbal(template, client_data, output)
print(f"OK PV genere : {output} ({os.path.getsize(output)} octets)")
