"""
Génération de la Fiche de Travaux LBP via ReportLab.
PDF créé from scratch (pas de template à remplir).
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER


# Chemin vers le tampon LBP (à uploader manuellement)
SIGNATURE_PATH = Path("/app/assets/signature_lbp.jpg")


def _fmt_eur(value):
    """0.0 -> '0,00 €' ; 1234.5 -> '1 234,50 €'."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        v = 0.0
    s = f"{v:,.2f}".replace(",", " ").replace(".", ",")
    return f"{s} \u20ac"


def generate_fiche_travaux_pdf(client_data, output_path):
    """
    Génère une fiche de travaux LBP from scratch avec ReportLab.

    client_data attend :
    - nom, prenom, adresse, code_postal, ville
    - description_travaux
    - montant_ht, montant_tva, montant_ttc (strings)
    - sinistre, reference_ma (optionnels)
    - date_rdv (string ex: "27/04/2026")
    """
    nom = client_data.get("nom", "")
    prenom = client_data.get("prenom", "")
    nom_complet = (nom + " " + prenom).strip().upper()
    adresse = client_data.get("adresse", "")
    cp = client_data.get("code_postal", "")
    ville = client_data.get("ville", "")
    description = client_data.get("description_travaux", "")

    def _to_float(s):
        try:
            return float(str(s).replace(",", "."))
        except (TypeError, ValueError):
            return 0.0

    montant_ht_val = _to_float(client_data.get("montant_ht", "0"))
    montant_tva_val = _to_float(client_data.get("montant_tva", "0"))
    montant_ttc_val = _to_float(client_data.get("montant_ttc", "0"))
    if montant_ttc_val == 0 and montant_ht_val > 0:
        montant_ttc_val = montant_ht_val + montant_tva_val

    PAGE_W, PAGE_H = A4
    MARGIN_L = 18 * mm
    MARGIN_R = 18 * mm
    CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

    c = canvas.Canvas(str(output_path), pagesize=A4)

    # ---------- Titre ----------
    title_y_top = PAGE_H - 22 * mm
    c.setLineWidth(3.68)
    c.line(MARGIN_L, title_y_top, PAGE_W - MARGIN_R, title_y_top)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(PAGE_W / 2, title_y_top - 8 * mm, "FICHE DE TRAVAUX")
    c.line(MARGIN_L, title_y_top - 12 * mm, PAGE_W - MARGIN_R, title_y_top - 12 * mm)
    c.setLineWidth(1)

    # ---------- Styles ----------
    styles = getSampleStyleSheet()
    style_bold = ParagraphStyle("bold", parent=styles["Normal"],
                                fontName="Helvetica-Bold", fontSize=8.5, leading=11)
    style_norm = ParagraphStyle("norm", parent=styles["Normal"],
                                fontName="Helvetica", fontSize=8.5, leading=11)

    def cell(label, lines):
        parts = []
        if label:
            parts.append(Paragraph(label, style_bold))
        for ln in (lines or []):
            if ln:
                parts.append(Paragraph(ln, style_norm))
        return parts

    # ---------- Bloc d'en-tête ----------
    c1_l1 = cell("Coordonn\u00e9es de l\u00b4entreprise:",
                 ["Multiassistance par Promultitravaux",
                  "19, Rue Emmy Noehter-93400-Saint Ouen-Seine-Saint-Denis"])
    c2_l1 = cell("R\u00e9f\u00e9rences:", [
        f"Cie: SINISTRES - PACIFICA",
        f"N\u00ba sinistre: {client_data.get('sinistre', '')}",
    ])
    c3_l1 = cell("Nom et adresse du client:",
                 [nom_complet, adresse, f"{cp} - {ville.upper()}"])

    c1_l2 = cell("Coordonn\u00e9es du Sous-traitant:",
                 ["LES BONS PLOMBIERS", "9 AVENUE JEAN JAURES", "75019 PARIS"])
    c2_l2 = cell("", [
        f"R\u00e9f MA : {client_data.get('reference_ma', '')}",
        f"Franchise r\u00e9gl\u00e9e: 0,00",
    ])
    c3_l2 = cell("", [])

    header_data = [[c1_l1, c2_l1, c3_l1], [c1_l2, c2_l2, c3_l2]]
    col_w = CONTENT_W / 3.0
    header_table = Table(header_data, colWidths=[col_w, col_w, col_w])
    header_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    header_y = title_y_top - 22 * mm
    hw, hh = header_table.wrap(CONTENT_W, 200)
    header_table.drawOn(c, MARGIN_L, header_y - hh)

    # ---------- Bandeau ----------
    banner_y_top = header_y - hh - 4 * mm
    banner_style = ParagraphStyle("banner", parent=styles["Normal"],
                                  fontName="Helvetica", fontSize=9,
                                  alignment=TA_CENTER, leading=12)
    banner_para = Paragraph(
        "A la R\u00e9ception des Travaux, le Sous-traitant d\u00e9sign\u00e9 ci-dessus est habilit\u00e9 \u00e0 recevoir "
        "tout ou partie du r\u00e8glement<br/>restant \u00e0 sa charge.",
        banner_style)
    banner_table = Table([[banner_para]], colWidths=[CONTENT_W])
    banner_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    bw, bh = banner_table.wrap(CONTENT_W, 200)
    banner_table.drawOn(c, MARGIN_L, banner_y_top - bh)

    # ---------- Tableau travaux ----------
    work_y_top = banner_y_top - bh - 4 * mm
    head_style = ParagraphStyle("th", parent=styles["Normal"],
                                fontName="Helvetica-Bold", fontSize=8.5, leading=10)
    cell_style = ParagraphStyle("td", parent=styles["Normal"],
                                fontName="Helvetica", fontSize=8.5, leading=10)
    cell_right = ParagraphStyle("tdr", parent=cell_style, alignment=TA_RIGHT)

    headers = [
        Paragraph("Pi\u00e8ce<br/>touch\u00e9e", head_style),
        Paragraph("Partie<br/>trait\u00e9e", head_style),
        Paragraph("Description", head_style),
        Paragraph("Objet des<br/>travaux", head_style),
        Paragraph("Quantit\u00e9", head_style),
        Paragraph("Etat", head_style),
        Paragraph("Montant", head_style),
    ]

    work_data = [headers]
    work_data.append([
        Paragraph("Logement", cell_style),
        Paragraph("Plomberie", cell_style),
        Paragraph(description, cell_style),
        Paragraph("R\u00e9paration", cell_style),
        Paragraph("1", cell_style),
        Paragraph("Fait", cell_style),
        Paragraph(_fmt_eur(montant_ht_val), cell_right),
    ])

    col_widths = [CONTENT_W * w for w in (0.10, 0.10, 0.28, 0.14, 0.10, 0.14, 0.14)]
    work_table = Table(work_data, colWidths=col_widths, repeatRows=1)
    work_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    ww, wh = work_table.wrap(CONTENT_W, 400)
    work_table.drawOn(c, MARGIN_L, work_y_top - wh)

    # ---------- Bloc totaux ----------
    totals_y_top = work_y_top - wh - 6 * mm
    label_style = ParagraphStyle("tlbl", parent=styles["Normal"],
                                 fontName="Helvetica-Bold", fontSize=8.5, leading=10)
    val_style = ParagraphStyle("tval", parent=styles["Normal"],
                               fontName="Helvetica", fontSize=8.5,
                               alignment=TA_RIGHT, leading=10)

    totals_data = [
        [Paragraph("Montant d\u00fb par le Client HT", label_style),
         Paragraph(_fmt_eur(montant_ht_val), val_style)],
        [Paragraph("Montant TVA (10)", label_style),
         Paragraph(_fmt_eur(montant_tva_val), val_style)],
        [Paragraph("Acompte", label_style),
         Paragraph(_fmt_eur(0), val_style)],
        [Paragraph("Montant d\u00fb par le Client TTC", label_style),
         Paragraph(_fmt_eur(montant_ttc_val), val_style)],
    ]
    totals_w = CONTENT_W * 0.45
    totals_table = Table(totals_data, colWidths=[totals_w * 0.65, totals_w * 0.35])
    totals_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    tw, th = totals_table.wrap(totals_w, 200)
    totals_table.drawOn(c, PAGE_W - MARGIN_R - tw, totals_y_top - th)

    # ---------- Mention TVA ----------
    tva_y = totals_y_top - th - 6 * mm
    c.setFont("Helvetica", 8.5)
    c.drawString(MARGIN_L, tva_y,
                 "Le taux de TVA appliqu\u00e9 est indicatif. C\u2019est le taux de TVA en vigueur lors de "
                 "l\u2019\u00e9mission de la facture qui sera appliqu\u00e9.")

    # ---------- Mention "Fait en 2 exemplaires" ----------
    fait_y = tva_y - 18 * mm
    c.setFont("Helvetica", 9)
    lieu_txt = ville or "............."
    date_txt = client_data.get("date_rdv", "............")
    c.drawCentredString(PAGE_W / 2 + 30 * mm, fait_y,
                        f"Fait en 2 exemplaires \u00e0 {lieu_txt}, le {date_txt}")

    # ---------- Lignes signatures ----------
    sig_y = fait_y - 12 * mm
    left_sig_x = MARGIN_L
    right_sig_x = PAGE_W - MARGIN_R - 60 * mm
    c.setFont("Helvetica", 9)
    c.drawString(left_sig_x, sig_y, "Date et Signature du Sous-traitant")
    c.line(left_sig_x, sig_y - 1,
           left_sig_x + c.stringWidth("Date et Signature du Sous-traitant", "Helvetica", 9),
           sig_y - 1)
    c.drawString(right_sig_x, sig_y, "Date et Signature du Client")
    c.line(right_sig_x, sig_y - 1,
           right_sig_x + c.stringWidth("Date et Signature du Client", "Helvetica", 9),
           sig_y - 1)

    # ---------- Cachet sous-traitant (image) ----------
    if SIGNATURE_PATH.exists():
        stamp_y = sig_y - 4 * mm
        sig_w = 62 * mm
        sig_h = sig_w * (302 / 636)
        try:
            c.drawImage(str(SIGNATURE_PATH), left_sig_x, stamp_y - sig_h,
                        width=sig_w, height=sig_h,
                        mask='auto', preserveAspectRatio=True)
        except Exception as e:
            print(f"[warn] signature non insérée: {e}")
    else:
        print(f"[warn] Pas de cachet trouvé à {SIGNATURE_PATH}")

    c.save()
    return str(output_path)
