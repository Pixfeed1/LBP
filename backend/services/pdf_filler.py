#!/usr/bin/env python3
"""
Remplissage des 3 PDFs avec les données client.
Documents : Attestation TVA, Procès Verbal, Délégation de paiement.
"""

import fitz
import os
import tempfile
from datetime import datetime


def fill_attestation_tva(template_path, client_data, output_path):
    """Remplit l'attestation TVA (1 page)."""
    doc = fitz.open(template_path)
    page = doc[0]

    date_str = client_data.get("date_rdv", datetime.now().strftime("%d/%m/%Y"))

    fields = [
        # Identité du client
        {"text": client_data.get("nom", ""), "x": 95, "y": 158, "size": 9},
        {"text": client_data.get("prenom", ""), "x": 310, "y": 158, "size": 9},
        {"text": client_data.get("adresse", ""), "x": 95, "y": 170, "size": 8},
        {"text": client_data.get("code_postal", ""), "x": 330, "y": 170, "size": 9},
        {"text": client_data.get("ville", ""), "x": 410, "y": 164, "size": 9},
        # Adresse des locaux
        {"text": client_data.get("adresse", ""), "x": 95, "y": 305, "size": 8},
        {"text": client_data.get("ville", ""), "x": 300, "y": 305, "size": 9},
        {"text": client_data.get("code_postal", ""), "x": 460, "y": 305, "size": 9},
        # Fait à [VILLE], le [DATE]
        {"text": client_data.get("ville", ""), "x": 290, "y": 680, "size": 9},
        {"text": date_str, "x": 390, "y": 680, "size": 9},
    ]

    for f in fields:
        if f["text"]:
            page.insert_text(fitz.Point(f["x"], f["y"]), f["text"],
                             fontname="helv", fontsize=f["size"], color=(0, 0, 0))

    doc.save(output_path)
    doc.close()
    print(f"[PDF] Attestation TVA remplie → {output_path}")


def fill_proces_verbal(template_path, client_data, output_path):
    """Remplit le procès-verbal de réception de travaux."""
    doc = fitz.open(template_path)
    page = doc[0]

    date_str = client_data.get("date_rdv", datetime.now().strftime("%d/%m/%Y"))
    nom_complet = f"{client_data.get('nom', '')}  {client_data.get('prenom', '')}"
    adresse_complete = f"{client_data.get('adresse', '')} {client_data.get('code_postal', '')} - {client_data.get('ville', '')}"

    # Zones à effacer puis remplir - rects précis pour ne pas effacer les bordures
    replacements = [
        # N° sinistre (juste le texte, pas le label)
        {"rect": [195, 63, 355, 74], "text": f"Nº sinistre: {client_data.get('sinistre', '')}", "x": 195, "y": 73, "size": 8},
        # Compagnie assurance
        {"rect": [195, 74, 355, 96], "text": f"Cie: SINISTRES - PACIFICA", "x": 195, "y": 86, "size": 8},
        # Nom client (juste la zone texte, pas la bordure)
        {"rect": [367, 74, 555, 88], "text": nom_complet, "x": 367, "y": 86, "size": 9},
        # Adresse client
        {"rect": [367, 94, 555, 110], "text": client_data.get("adresse", ""), "x": 367, "y": 106, "size": 8},
        # Réf MA
        {"rect": [195, 95, 355, 107], "text": f"Réf MA : {client_data.get('reference_ma', '')}", "x": 195, "y": 106, "size": 8},
        # CP + Ville client
        {"rect": [367, 115, 555, 128], "text": f"{client_data.get('code_postal', '')} - {client_data.get('ville', '')}", "x": 367, "y": 126, "size": 9},
    ]

    for r in replacements:
        if r["text"]:
            rect = fitz.Rect(r["rect"])
            page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
            page.insert_text(fitz.Point(r["x"], r["y"]), r["text"],
                             fontname="helv", fontsize=r["size"], color=(0, 0, 0))

    # Champs texte (je soussigné, fait à, date)
    text_fields = [
        # Je soussigné
        {"text": nom_complet, "x": 155, "y": 291, "size": 9},
        # Adresse dans "située..." - ligne en dessous
        {"text": adresse_complete, "x": 30, "y": 314, "size": 7},
        # Fait en 3 exemplaires - section 1
        {"text": client_data.get("ville", ""), "x": 415, "y": 481, "size": 8},
        {"text": date_str, "x": 485, "y": 481, "size": 8},
        # Fait en 3 exemplaires - section 2 (levée des réserves)
        {"text": client_data.get("ville", ""), "x": 415, "y": 637, "size": 8},
        {"text": date_str, "x": 485, "y": 637, "size": 8},
    ]

    for f in text_fields:
        if f["text"]:
            page.insert_text(fitz.Point(f["x"], f["y"]), f["text"],
                             fontname="helv", fontsize=f["size"], color=(0, 0, 0))

    doc.save(output_path)
    doc.close()
    print(f"[PDF] Procès Verbal rempli → {output_path}")


def fill_delegation_paiement(template_path, client_data, output_path):
    """Remplit la délégation de paiement avec lu et approuvé + fait à."""
    doc = fitz.open(template_path)
    page = doc[0]

    date_str = client_data.get("date_rdv", datetime.now().strftime("%d/%m/%Y"))
    nom_complet = f"{client_data.get('nom', '')}  {client_data.get('prenom', '')}"

    # Zones à effacer puis remplir
    replacements = [
        # N° contrat
        {"rect": [110, 105, 220, 128], "text": client_data.get("contrat", ""), "x": 120, "y": 123, "size": 10},
        # N° sinistre
        {"rect": [110, 126, 280, 148], "text": client_data.get("sinistre", ""), "x": 120, "y": 143, "size": 10},
        # Nom client
        {"rect": [120, 180, 400, 200], "text": nom_complet, "x": 130, "y": 196, "size": 10},
        # Adresse complète
        {"rect": [100, 200, 560, 220], "text": f"{client_data.get('adresse', '')} {client_data.get('code_postal', '')} - {client_data.get('ville', '')}", "x": 110, "y": 216, "size": 9},
    ]

    for r in replacements:
        if r["text"]:
            rect = fitz.Rect(r["rect"])
            page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
            page.insert_text(fitz.Point(r["x"], r["y"]), r["text"],
                             fontname="helv", fontsize=r["size"], color=(0, 0, 0))

    # Fait à + date + lu et approuvé (côté droit, au-dessus de la signature)
    extra_fields = [
        {"text": f"Fait à {client_data.get('ville', '')}, le {date_str}", "x": 350, "y": 420, "size": 9},
        {"text": "Lu et approuvé", "x": 380, "y": 440, "size": 9},
    ]

    for f in extra_fields:
        if f["text"]:
            page.insert_text(fitz.Point(f["x"], f["y"]), f["text"],
                             fontname="helv", fontsize=f["size"], color=(0, 0, 0))

    doc.save(output_path)
    doc.close()
    print(f"[PDF] Délégation de paiement remplie → {output_path}")


def fill_all_pdfs(pdf_templates, client_data):
    """Remplit les 3 PDFs et retourne les chemins des fichiers remplis."""
    output_dir = tempfile.mkdtemp(prefix="yousign_pdfs_")
    filled_paths = {}

    tpl = pdf_templates.get("attestation_tva")
    if tpl and os.path.exists(tpl):
        out = os.path.join(output_dir, "Attestation TVA.pdf")
        fill_attestation_tva(tpl, client_data, out)
        filled_paths["attestation_tva"] = out

    tpl = pdf_templates.get("proces_verbal")
    if tpl and os.path.exists(tpl):
        out = os.path.join(output_dir, "Procès Verbal.pdf")
        fill_proces_verbal(tpl, client_data, out)
        filled_paths["proces_verbal"] = out

    tpl = pdf_templates.get("delegation_paiement")
    if tpl and os.path.exists(tpl):
        out = os.path.join(output_dir, "Délégation de paiement.pdf")
        fill_delegation_paiement(tpl, client_data, out)
        filled_paths["delegation_paiement"] = out

    return filled_paths
