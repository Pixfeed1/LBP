"""
Generateur de Declaration et Delegation de Paiement LBP.
Style visuel : reproduit la mise en page sobre du template Pacifica original,
mais avec le contenu LBP (particuliers, sans references assurance).
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_JUSTIFY


FOOTER_RESERVED_HEIGHT = 18 * 2.83465  # marge bas reservee pour bandeau juridique


def _checkbox(c, x, y, size=4):
    """Petite case a cocher style Pacifica (carre vide bordure fine)."""
    c.setLineWidth(0.6)
    c.setStrokeColor(colors.black)
    c.rect(x, y, size, size, stroke=1, fill=0)


def generate_delegation_pdf(client_data, output_path):
    """
    Genere une Declaration et Delegation de Paiement LBP (style Pacifica epure).

    client_data attend :
    - nom, prenom, adresse, code_postal, ville
    - date_rdv (string ex: "15/05/2026")
    - montant_ht, montant_tva, montant_ttc (string)
    - reference_intervention (optionnel)
    """
    nom = client_data.get("nom", "")
    prenom = client_data.get("prenom", "")
    nom_complet = (nom + " " + prenom).strip()
    adresse = client_data.get("adresse", "")
    cp = client_data.get("code_postal", "")
    ville = client_data.get("ville", "")
    date_str = client_data.get("date_rdv", "")
    ref_intervention = client_data.get("reference_intervention", "")
    montant_ht = client_data.get("montant_ht", "")
    montant_tva = client_data.get("montant_tva", "")
    montant_ttc = client_data.get("montant_ttc", "")

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4

    body_style = ParagraphStyle(
        'body', fontName='Helvetica', fontSize=10, leading=13,
        alignment=TA_JUSTIFY, textColor=colors.black,
    )

    # === TITRE ===
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 12)
    title = "DECLARATION, DELEGATION DE PAIEMENT ET ENGAGEMENT DU CLIENT"
    text_w = c.stringWidth(title, "Helvetica-Bold", 12)
    c.drawString((width - text_w) / 2, height - 25 * mm, title)

    # === SECTION : Vos references ===
    y = height - 42 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Vos references")
    y -= 7 * mm
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y, f"N\u00b0 d'intervention :  {ref_intervention}")
    y -= 5 * mm
    c.drawString(20 * mm, y, f"Date d'intervention :  {date_str}")

    # === SECTION : Client ===
    y -= 12 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Client")
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y, f"Je soussigne(e)*, {nom_complet},")
    y -= 6 * mm
    c.drawString(20 * mm, y, f"demeurant a  {adresse}  -  {cp}  {ville},")

    # === ENGAGEMENTS ===
    y -= 10 * mm
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y, "-")
    p1 = Paragraph(
        "Confirme donner mon accord pour la realisation des travaux decrits au devis, "
        "par l'entreprise <b>LES BONS PLOMBIERS</b>.",
        body_style
    )
    _, p1_h = p1.wrap(width - 50 * mm, 30 * mm)
    p1.drawOn(c, 25 * mm, y - p1_h + 9)
    y -= max(p1_h, 6 * mm) + 4 * mm

    c.drawString(20 * mm, y, "-")
    p2 = Paragraph(
        "M'engage a regler directement a l'entreprise <b>LES BONS PLOMBIERS</b>, "
        "conformement au devis accepte, les sommes suivantes :",
        body_style
    )
    _, p2_h = p2.wrap(width - 50 * mm, 30 * mm)
    p2.drawOn(c, 25 * mm, y - p2_h + 9)
    y -= max(p2_h, 6 * mm) + 7 * mm

    # === CHECKBOXES ===
    box_x = 28 * mm
    line_h = 7 * mm
    items = [
        ("Le montant HT qui s'eleve a", montant_ht),
        ("Le montant de la TVA qui s'eleve a", montant_tva),
        ("Le montant TTC qui s'eleve a", montant_ttc),
    ]
    c.setFont("Helvetica", 10)
    for label, montant in items:
        _checkbox(c, box_x, y - 1, size=3.5 * mm)
        montant_txt = f": {montant} EUR" if montant else ":"
        c.drawString(box_x + 6 * mm, y, f"{label} {montant_txt}")
        y -= line_h

    _checkbox(c, box_x, y - 1, size=3.5 * mm)
    c.drawString(box_x + 6 * mm, y, "Autres a preciser : _______________________________________________")
    y -= 12 * mm

    # === CADRE SIGNATURE ===
    box_left = 20 * mm
    box_width = width - 40 * mm
    box_height = 42 * mm
    box_top = y
    box_bottom = box_top - box_height

    c.setLineWidth(0.6)
    c.setStrokeColor(colors.black)
    c.rect(box_left, box_bottom, box_width, box_height, stroke=1, fill=0)

    c.setFont("Helvetica", 10)
    c.drawString(box_left + 5 * mm, box_top - 8 * mm, f"Fait a  {ville}")
    c.drawString(box_left + 80 * mm, box_top - 8 * mm, f", le  {date_str}")

    c.setFont("Helvetica", 9)
    c.drawString(box_left + 5 * mm, box_bottom + 4 * mm,
                 "Signature precedee de la mention manuscrite : \u00ab Bon pour accord \u00bb")

    # === FOOTNOTE ===
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.HexColor("#555555"))
    c.drawString(20 * mm, 30 * mm,
                 "* Le client soussigne reconnait avoir pris connaissance des conditions generales d'intervention.")

    c.save()
    print(f"[PDF] Delegation LBP generee -> {output_path}")
