#!/usr/bin/env python3
"""
Remplissage des PDFs avec les données client (PyMuPDF/fitz).
Documents : Attestation TVA, Procès Verbal, Délégation de paiement, Fiche Travaux.
"""

import fitz
import os
from datetime import datetime


def fill_attestation_tva(template_path, client_data, output_path):
    """Remplit l'attestation TVA (1 page)."""
    doc = fitz.open(template_path)
    page = doc[0]

    date_str = client_data.get("date_rdv", datetime.now().strftime("%d/%m/%Y"))

    fields = [
        # Identité du client
        {"text": client_data.get("nom", ""), "x": 95, "y": 158, "size": 9},
        {"text": client_data.get("prenom", ""), "x": 325, "y": 158, "size": 9},
        {"text": client_data.get("adresse", ""), "x": 95, "y": 170, "size": 8},
        {"text": client_data.get("code_postal", ""), "x": 330, "y": 170, "size": 9},
        {"text": client_data.get("ville", ""), "x": 410, "y": 170, "size": 9},
        # Adresse des locaux
        {"text": client_data.get("adresse", ""), "x": 95, "y": 305, "size": 8},
        {"text": client_data.get("ville", ""), "x": 300, "y": 305, "size": 9},
        {"text": client_data.get("code_postal", ""), "x": 460, "y": 305, "size": 9},
        # Fait à [VILLE], le [DATE]
        {"text": client_data.get("ville", ""), "x": 280, "y": 677, "size": 9},
        {"text": date_str, "x": 380, "y": 677, "size": 9},
    ]

    for f in fields:
        if f["text"]:
            page.insert_text(fitz.Point(f["x"], f["y"]), f["text"],
                             fontname="helv", fontsize=f["size"], color=(0, 0, 0))

    doc.save(output_path)
    doc.close()
    print(f"[PDF] Attestation TVA remplie -> {output_path}")


def fill_proces_verbal(template_path, client_data, output_path):
    """Remplit le procès-verbal de réception de travaux."""
    doc = fitz.open(template_path)
    page = doc[0]

    date_str = client_data.get("date_rdv", datetime.now().strftime("%d/%m/%Y"))
    nom_complet = (client_data.get("nom", "") + " " + client_data.get("prenom", "")).strip()
    adresse_complete = (client_data.get("adresse", "") + " " + client_data.get("code_postal", "") + " - " + client_data.get("ville", "")).strip()

    # Effacer + remplir (cohérent avec projet 1)
    sinistre_text = "N sinistre: " + client_data.get("sinistre", "")
    cie_text = "Cie: SINISTRES - PACIFICA"
    ref_ma_text = "Ref MA : " + client_data.get("reference_ma", "")
    franchise_text = "Franchise reglee: 0,00"

    replacements = [
        # N° sinistre
        {"rect": [195, 63, 355, 74], "text": sinistre_text, "x": 195, "y": 73, "size": 8},
        # Compagnie assurance
        {"rect": [195, 74, 355, 96], "text": cie_text, "x": 195, "y": 86, "size": 8},
        # Réf MA
        {"rect": [195, 96, 355, 110], "text": ref_ma_text, "x": 195, "y": 106, "size": 8},
        # Franchise
        {"rect": [195, 110, 355, 122], "text": franchise_text, "x": 195, "y": 119, "size": 8},
        # N° sinistre dans le formulaire (en bas)
        {"rect": [110, 126, 280, 148], "text": client_data.get("sinistre", ""), "x": 120, "y": 143, "size": 10},
    ]

    for r in replacements:
        # Effacer la zone
        page.draw_rect(fitz.Rect(r["rect"]), color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
        # Réécrire
        if r["text"]:
            page.insert_text(fitz.Point(r["x"], r["y"]), r["text"],
                             fontname="helv", fontsize=r["size"], color=(0, 0, 0))

    # Champs du client
    fields = [
        # Nom et adresse du client (cadre haut droite)
        {"text": nom_complet, "x": 410, "y": 95, "size": 9},
        {"text": client_data.get("adresse", ""), "x": 410, "y": 109, "size": 8},
        {"text": client_data.get("code_postal", "") + " - " + client_data.get("ville", ""), "x": 410, "y": 122, "size": 8},

        # Je soussigné(e) ... atteste que la date de construction de l'habitation
        {"text": nom_complet, "x": 165, "y": 218, "size": 9},
        # Adresse de l'habitation
        {"text": adresse_complete, "x": 70, "y": 240, "size": 8},
        # > 2 ans : coche X
        {"text": "X" if client_data.get("logement_plus_2_ans", "Y") == "Y" else "", "x": 211, "y": 263, "size": 12},
        # Description travaux
        {"text": client_data.get("description_travaux", ""), "x": 70, "y": 372, "size": 9},
        # Fait à [VILLE], le [DATE] (2 fois sur le doc)
        {"text": client_data.get("ville", ""), "x": 365, "y": 460, "size": 9},
        {"text": date_str, "x": 470, "y": 460, "size": 9},
        {"text": client_data.get("ville", ""), "x": 365, "y": 600, "size": 9},
        {"text": date_str, "x": 470, "y": 600, "size": 9},
    ]

    for f in fields:
        if f["text"]:
            page.insert_text(fitz.Point(f["x"], f["y"]), f["text"],
                             fontname="helv", fontsize=f["size"], color=(0, 0, 0))

    doc.save(output_path)
    doc.close()
    print(f"[PDF] Proces Verbal rempli -> {output_path}")


def fill_delegation_paiement(template_path, client_data, output_path):
    """Remplit la délégation de paiement (1 page)."""
    doc = fitz.open(template_path)
    page = doc[0]

    date_str = client_data.get("date_rdv", datetime.now().strftime("%d/%m/%Y"))
    nom_complet = (client_data.get("nom", "") + " " + client_data.get("prenom", "")).strip()

    fields = [
        # Identité client
        {"text": nom_complet, "x": 165, "y": 218, "size": 9},
        # Adresse
        {"text": client_data.get("adresse", ""), "x": 70, "y": 240, "size": 8},
        {"text": client_data.get("code_postal", ""), "x": 350, "y": 240, "size": 9},
        {"text": client_data.get("ville", ""), "x": 410, "y": 240, "size": 9},
        # Date + Ville
        {"text": client_data.get("ville", ""), "x": 290, "y": 680, "size": 9},
        {"text": date_str, "x": 390, "y": 680, "size": 9},
    ]

    for f in fields:
        if f["text"]:
            page.insert_text(fitz.Point(f["x"], f["y"]), f["text"],
                             fontname="helv", fontsize=f["size"], color=(0, 0, 0))

    doc.save(output_path)
    doc.close()
    print(f"[PDF] Delegation de paiement remplie -> {output_path}")


def fill_fiche_travaux(template_path, client_data, output_path):
    """Remplit la fiche de travaux LBP."""
    doc = fitz.open(template_path)
    page = doc[0]

    date_str = client_data.get("date_rdv", datetime.now().strftime("%d/%m/%Y"))
    nom = client_data.get("nom", "")
    prenom = client_data.get("prenom", "")
    nom_complet = (nom + " " + prenom).strip().upper()
    adresse = client_data.get("adresse", "").upper()
    cp_ville = (client_data.get("code_postal", "") + " - " + client_data.get("ville", "").upper()).strip(" -")

    description = client_data.get("description_travaux", "")
    if len(description) > 50:
        description = description[:50]

    montant_ht = client_data.get("montant_ht", "0,00")
    montant_tva = client_data.get("montant_tva", "0,00")
    montant_ttc = client_data.get("montant_ttc", "0,00")

    # === EFFACER les 4 "0,00 €" du template via search_for ===
    # PyMuPDF trouve automatiquement les positions du texte
    instances = page.search_for("0,00 €")
    print(f"[PDF] Trouvé {len(instances)} occurrences de '0,00 €' à effacer")
    for rect in instances:
        # Étendre légèrement le rect pour bien couvrir
        bigger_rect = fitz.Rect(rect.x0 - 2, rect.y0 - 1, rect.x1 + 2, rect.y1 + 1)
        page.draw_rect(bigger_rect, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)

    fields = [
        # === Colonne 2 : Références ===
        {"text": "SINISTRES - PACIFICA", "x": 240, "y": 153, "size": 8},
        {"text": client_data.get("sinistre", ""), "x": 245, "y": 148, "size": 8},
        {"text": client_data.get("reference_ma", ""), "x": 220, "y": 196, "size": 8},

        # === Colonne 3 : Nom et adresse du client ===
        {"text": nom_complet, "x": 405, "y": 148, "size": 9},
        {"text": adresse, "x": 405, "y": 162, "size": 8},
        {"text": cp_ville, "x": 405, "y": 196, "size": 8},

        # === Tableau description travaux ===
        {"text": "Logement", "x": 50, "y": 305, "size": 8},
        {"text": "Plomberie", "x": 105, "y": 305, "size": 8},
        {"text": description, "x": 165, "y": 305, "size": 8},
        {"text": "Reparation", "x": 350, "y": 305, "size": 8},
        {"text": "1", "x": 425, "y": 305, "size": 8},
        {"text": "Fait", "x": 460, "y": 305, "size": 8},
        {"text": montant_ht + " EUR", "x": 510, "y": 305, "size": 8},

        # === Bloc montants ===
        {"text": montant_ht + " EUR", "x": 535, "y": 315, "size": 8},
        {"text": montant_tva + " EUR", "x": 535, "y": 328, "size": 8},
        {"text": "0,00 EUR", "x": 535, "y": 340, "size": 8},
        {"text": montant_ttc + " EUR", "x": 535, "y": 353, "size": 8},

        # === Fait à [VILLE], le [DATE] ===
        {"text": client_data.get("ville", ""), "x": 360, "y": 482, "size": 9},
        {"text": date_str, "x": 440, "y": 482, "size": 9},
    ]

    for f in fields:
        if f["text"]:
            page.insert_text(fitz.Point(f["x"], f["y"]), f["text"],
                             fontname="helv", fontsize=f["size"], color=(0, 0, 0))

    doc.save(output_path)
    doc.close()
    print(f"[PDF] Fiche travaux remplie -> {output_path}")


def fill_all_pdfs(pdf_templates, client_data):
    """Remplit tous les PDFs (utilitaire batch)."""
    results = {}

    for doc_type, paths in pdf_templates.items():
        template = paths.get("template")
        output = paths.get("output")
        if not template or not output:
            continue

        try:
            if doc_type == "attestation_tva":
                fill_attestation_tva(template, client_data, output)
            elif doc_type == "proces_verbal":
                fill_proces_verbal(template, client_data, output)
            elif doc_type == "delegation_paiement":
                fill_delegation_paiement(template, client_data, output)
            elif doc_type == "fiche_travaux":
                fill_fiche_travaux(template, client_data, output)
            results[doc_type] = output
        except Exception as e:
            print(f"[PDF] Erreur sur {doc_type} : {e}")
            results[doc_type] = None

    return results
