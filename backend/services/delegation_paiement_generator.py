"""
Generateur de Declaration, Delegation de Paiement et Engagement de l'Assure (LBP).
Style et contenu calques sur le modele Pacifica/Multiassistance fourni par Kevin (20/05).

Structure :
- En-tete refs Pacifica (N Contrat + N Sinistre) si presents dans Calendar
- Section Assure (nom + adresse complete)
- 3 bullets juridiques : accord travaux / delegation paiement / engagement reglement
- 4 checkboxes (franchise/vetuste/TVA/autres), franchise pre-cochee par defaut
- Cadre signature avec "Fait a [ville], le [date]" + mention "Bon pour accord"
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_JUSTIFY


def _checkbox(c, x, y, size=4, checked=False):
    """Case a cocher style Pacifica."""
    c.setLineWidth(0.7)
    c.setStrokeColor(colors.black)
    c.rect(x, y, size, size, stroke=1, fill=0)
    if checked:
        c.setFont("Helvetica-Bold", size * 1.6)
        c.setFillColor(colors.black)
        # Petit "X" centre dans la case
        c.drawCentredString(x + size / 2, y + size / 4 - 2.8, "X")


def generate_delegation_pdf(client_data, output_path):
    """
    Genere une Declaration, Delegation de Paiement et Engagement de l'Assure.

    client_data attend :
    - nom, prenom
    - adresse, code_postal, ville
    - date_rdv (string ex: "15/05/2026")
    - numero_contrat (string, optionnel) - depuis Calendar "CONTRAT: XXX"
    - numero_sinistre (string, optionnel) - depuis Calendar "SINISTRE: XXX"
    - franchise (string, optionnel, ex: "0,00 \u20ac") - parse depuis Calendar "FRANCHISE: ..."
    """
    nom = client_data.get("nom", "") or ""
    prenom = client_data.get("prenom", "") or ""
    nom_complet = f"{nom} {prenom}".strip()
    adresse = client_data.get("adresse", "") or ""
    cp = client_data.get("code_postal", "") or ""
    ville = client_data.get("ville", "") or ""
    date_str = client_data.get("date_rdv", "") or ""
    numero_contrat = client_data.get("numero_contrat", "") or ""
    numero_sinistre = client_data.get("numero_sinistre", "") or ""
    franchise = client_data.get("franchise", "") or "0,00 \u20ac"

    # Adresse complete pour le "demeurant a"
    parts = [p for p in [adresse, f"{cp} {ville}".strip()] if p]
    adresse_complete = " - ".join(parts) if parts else ""

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4

    body_style = ParagraphStyle(
        'body', fontName='Helvetica', fontSize=10, leading=14,
        alignment=TA_JUSTIFY, textColor=colors.black,
    )

    # === TITRE ===
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    title = "D\u00c9CLARATION, D\u00c9L\u00c9GATION DE PAIEMENT ET ENGAGEMENT DE L\u2019ASSUR\u00c9"
    text_w = c.stringWidth(title, "Helvetica-Bold", 11)
    c.drawString((width - text_w) / 2, height - 25 * mm, title)

    # === SECTION : Vos references ===
    y = height - 45 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Vos r\u00e9f\u00e9rences")
    y -= 6 * mm
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y, "N\u00b0 de Contrat :")
    if numero_contrat:
        c.drawString(50 * mm, y, numero_contrat)
    y -= 5 * mm
    c.drawString(20 * mm, y, "N\u00b0 de Sinistre :")
    if numero_sinistre:
        c.drawString(50 * mm, y, numero_sinistre)

    # === SECTION : Assure ===
    y -= 12 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Assur\u00e9")
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y, f"Je soussign\u00e9(e)*,  {nom_complet}," if nom_complet else "Je soussign\u00e9(e)*,")
    y -= 6 * mm
    c.drawString(20 * mm, y, f"demeurant \u00e0  {adresse_complete}" if adresse_complete else "demeurant \u00e0")

    # === 3 BULLETS JURIDIQUES ===
    y -= 12 * mm
    p1 = Paragraph(
        "- Confirme donner mon accord pour la r\u00e9alisation des travaux de remise en \u00e9tat "
        "des biens endommag\u00e9s lors du sinistre dont j'ai \u00e9t\u00e9 victime, dont r\u00e9f\u00e9rence en marge, "
        "par toute entreprise du R\u00e9seau <b>MULTIASSISTANCE</b>, pilot\u00e9 par "
        "<b>PROMULTITRAVAUX</b>, filiale de <b>MULTIASSISTANCE</b>.",
        body_style
    )
    _, p1_h = p1.wrap(width - 40 * mm, 40 * mm)
    p1.drawOn(c, 20 * mm, y - p1_h)
    y -= p1_h + 5 * mm

    p2 = Paragraph(
        "- D\u00e9l\u00e8gue \u00e0 ma compagnie d'assurance le soin de payer toute facture \u00e9mise en lien "
        "avec le sinistre et couverte par mon contrat d'assurance.",
        body_style
    )
    _, p2_h = p2.wrap(width - 40 * mm, 40 * mm)
    p2.drawOn(c, 20 * mm, y - p2_h)
    y -= p2_h + 5 * mm

    p3 = Paragraph(
        "- M'engage \u00e0 r\u00e9gler directement \u00e0 cette entreprise, conform\u00e9ment \u00e0 mon contrat "
        "d'assurance, les sommes suivantes :",
        body_style
    )
    _, p3_h = p3.wrap(width - 40 * mm, 40 * mm)
    p3.drawOn(c, 20 * mm, y - p3_h)
    y -= p3_h + 9 * mm

    # === CHECKBOXES ===
    box_x = 25 * mm
    line_h = 9 * mm
    cb_size = 4 * mm

    # 1. Franchise (pre-cochee selon modele Kevin)
    _checkbox(c, box_x, y - 1, size=cb_size, checked=True)
    c.setFont("Helvetica", 10)
    c.drawString(box_x + 7 * mm, y, f"La franchise contractuelle qui s'\u00e9l\u00e8ve \u00e0 : {franchise}")
    y -= line_h

    # 2. Vetuste
    _checkbox(c, box_x, y - 1, size=cb_size, checked=False)
    c.drawString(box_x + 7 * mm, y, "Le montant de la v\u00e9tust\u00e9 non r\u00e9cup\u00e9rable")
    y -= line_h

    # 3. TVA
    _checkbox(c, box_x, y - 1, size=cb_size, checked=False)
    c.drawString(box_x + 7 * mm, y, "Le montant de la TVA r\u00e9cup\u00e9rable")
    y -= line_h

    # 4. Autres
    _checkbox(c, box_x, y - 1, size=cb_size, checked=False)
    c.drawString(box_x + 7 * mm, y, "Autres \u00e0 pr\u00e9ciser")
    y -= 14 * mm

    # === CADRE SIGNATURE ===
    box_left = 20 * mm
    box_width = width - 40 * mm
    box_height = 38 * mm
    box_top = y
    box_bottom = box_top - box_height

    c.setLineWidth(0.6)
    c.setStrokeColor(colors.black)
    c.rect(box_left, box_bottom, box_width, box_height, stroke=1, fill=0)

    c.setFont("Helvetica", 10)
    c.drawString(box_left + 5 * mm, box_top - 8 * mm, "Fait \u00e0")
    if ville:
        c.drawString(box_left + 20 * mm, box_top - 8 * mm, ville)
    c.drawString(box_left + 80 * mm, box_top - 8 * mm, ", le")
    if date_str:
        c.drawString(box_left + 90 * mm, box_top - 8 * mm, date_str)

    c.setFont("Helvetica", 9)
    c.drawString(box_left + 5 * mm, box_bottom + 4 * mm,
                 "Signature pr\u00e9c\u00e9d\u00e9e de la mention \"Bon pour accord\"")

    c.save()
    print(f"[PDF] Delegation LBP (modele Kevin) generee -> {output_path}")
