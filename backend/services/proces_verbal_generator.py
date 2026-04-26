"""
Générateur de Procès-Verbal de Réception de Travaux via ReportLab.
"""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER


# Marge réservée en bas de page pour le bandeau juridique post-signature (18mm)
# Voir services/pdf_signing.py pour l'incrustation
FOOTER_RESERVED_HEIGHT = 18 * 2.83465  # 18mm en points (1mm = 2.83465pt)

ASSETS_DIR = Path("/app/assets")
SIGNATURE_PATH = ASSETS_DIR / "signature_lbp.jpg"
LOGO_PATH = ASSETS_DIR / "logo_promultitravaux.jpg"


def _draw_dotted_line_with_text(c, x, y, width, text="", font="Helvetica", font_size=10):
    """Dessine une ligne pointillée avec texte au début."""
    c.setFont(font, font_size)
    if text:
        c.drawString(x, y, text)
        text_w = c.stringWidth(text, font, font_size)
        x_start = x + text_w + 2
    else:
        x_start = x
    if x_start < x + width:
        c.setDash(1, 2)
        c.setLineWidth(0.5)
        c.line(x_start, y - 1, x + width, y - 1)
        c.setDash()


def _draw_checkbox(c, x, y, size=3 * mm, checked=False):
    """Petite case à cocher. Si checked=True, dessine un X."""
    c.setLineWidth(0.7)
    c.rect(x, y, size, size, stroke=1, fill=0)
    if checked:
        c.setLineWidth(1.0)
        c.line(x, y, x + size, y + size)
        c.line(x, y + size, x + size, y)


def _draw_signature(c, image_path, x, y, width=55 * mm):
    """Dessine le cachet."""
    height = width * (302 / 636)
    try:
        c.drawImage(str(image_path), x, y, width=width, height=height,
                    mask='auto', preserveAspectRatio=True)
    except Exception as e:
        print(f"[warn] cachet non inséré: {e}")


def generate_proces_verbal_pdf(client_data, output_path):
    """
    Génère un PV from scratch avec ReportLab.

    client_data attend :
    - nom, prenom, adresse, code_postal, ville
    - description_travaux
    - date_rdv (string)
    - sinistre, reference_ma (optionnels)
    - logement_plus_2_ans : "Y" ou "N"
    """
    nom = client_data.get("nom", "")
    prenom = client_data.get("prenom", "")
    nom_complet = (nom + " " + prenom).strip()
    adresse = client_data.get("adresse", "")
    cp = client_data.get("code_postal", "")
    ville = client_data.get("ville", "")
    description = client_data.get("description_travaux", "")
    date_str = client_data.get("date_rdv", "")
    plus_2_ans = client_data.get("logement_plus_2_ans", "Y") == "Y"
    
    adresse_complete_client = f"{adresse} {cp} - {ville}"

    PAGE_W, PAGE_H = A4
    MARGIN_L = 18 * mm
    MARGIN_R = 18 * mm
    CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

    c = canvas.Canvas(str(output_path), pagesize=A4)
    styles = getSampleStyleSheet()

    # ---------- Logo + Titre ----------
    title_y = PAGE_H - 22 * mm
    if LOGO_PATH.exists():
        try:
            logo_w = 18 * mm
            logo_h = logo_w * (29 / 60)
            c.drawImage(str(LOGO_PATH), MARGIN_L, title_y - 2 * mm,
                        width=logo_w, height=logo_h,
                        mask='auto', preserveAspectRatio=True)
        except Exception as e:
            print(f"[warn] logo non inséré: {e}")

    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(PAGE_W / 2, title_y,
                        "PROCES - VERBAL DE RECEPTION DE TRAVAUX")
    c.setLineWidth(0.7)
    c.line(MARGIN_L, title_y - 4 * mm, PAGE_W - MARGIN_R, title_y - 4 * mm)

    # ---------- Bloc d'en-tête ----------
    style_bold = ParagraphStyle("hb", parent=styles["Normal"],
                                fontName="Helvetica-Bold", fontSize=8.5, leading=11)
    style_norm = ParagraphStyle("hn", parent=styles["Normal"],
                                fontName="Helvetica", fontSize=8.5, leading=11)

    def P(text, bold=False):
        return Paragraph(text, style_bold if bold else style_norm)

    col1 = [
        P("Coordonn\u00e9es de l\u00b4entreprise:", bold=True),
        P("Multiassistance par Promultitravaux"),
        P("19, Rue Emmy Noehter-93400-Saint Ouen-Seine-Saint-Denis"),
        P("Coordonn\u00e9es du Sous-traitant:", bold=True),
        P(""),
        P("LES BONS PLOMBIERS"),
        P(""),
        P(""),
        P("9 AVENUE JEAN JAURES 75019 PARIS"),
    ]

    col2 = [
        P("R\u00e9f\u00e9rences:", bold=True),
        P(f"N\u00ba sinistre: {client_data.get('sinistre', '')}"),
        P(f"Cie: SINISTRES - PACIFICA"),
        P(""),
        P(""),
        P(f"R\u00e9f MA : {client_data.get('reference_ma', '')}"),
        P(""),
        P(""),
        P(f"Franchise r\u00e9gl\u00e9e: 0,00"),
    ]

    col3 = [P("Nom et adresse du client:", bold=True)]
    if nom_complet:
        col3.append(P(""))
        col3.append(P(nom_complet))
        col3.append(P(""))
    col3.append(P(adresse))
    col3.append(P(f"{cp} - {ville}"))

    col_w = CONTENT_W / 3.0
    header_table = Table([[col1, col2, col3]], colWidths=[col_w, col_w, col_w])
    header_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    header_y = title_y - 8 * mm
    hw, hh = header_table.wrap(CONTENT_W, 400)
    header_table.drawOn(c, MARGIN_L, header_y - hh)

    # ---------- Bandeau ----------
    banner_y_top = header_y - hh - 6 * mm
    banner_style = ParagraphStyle("ban", parent=styles["Normal"],
                                  fontName="Helvetica", fontSize=9,
                                  alignment=TA_CENTER, leading=12)
    banner_para = Paragraph(
        "A la R\u00e9ception des Travaux, le Sous-traitant d\u00e9sign\u00e9 ci-dessus est habilit\u00e9 \u00e0 recevoir "
        "tout ou partie du r\u00e8glement<br/>restant \u00e0 la charge du client.",
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

    # ---------- "Je soussigné(e)..." ----------
    y = banner_y_top - bh - 8 * mm
    _draw_dotted_line_with_text(
        c, MARGIN_L, y, CONTENT_W,
        text=f"Je soussign\u00e9(e) {nom_complet}",
        font="Helvetica", font_size=10,
    )

    y -= 5 * mm
    _draw_dotted_line_with_text(
        c, MARGIN_L, y, CONTENT_W,
        text=f"atteste que la date de construction de l\u00b4habitation, objet des travaux et situ\u00e9e {adresse_complete_client[:60]}",
        font="Helvetica", font_size=10,
    )
    y -= 5 * mm
    _draw_dotted_line_with_text(
        c, MARGIN_L, y, CONTENT_W,
        text=adresse_complete_client[60:120] if len(adresse_complete_client) > 60 else "",
        font="Helvetica", font_size=10,
    )

    # ---------- Choix > 2 ans / < 2 ans ----------
    y -= 7 * mm
    c.setFont("Helvetica", 10)
    c.drawString(MARGIN_L, y, "est:")
    box_size = 3.2 * mm
    c.drawString(MARGIN_L + 22 * mm, y, "> 2 ans")
    _draw_checkbox(c, MARGIN_L + 38 * mm, y - 0.5 * mm, size=box_size,
                   checked=plus_2_ans)
    c.drawString(MARGIN_L + 60 * mm, y, "<2 ans")
    _draw_checkbox(c, MARGIN_L + 75 * mm, y - 0.5 * mm, size=box_size,
                   checked=(not plus_2_ans))

    # ---------- Grand bloc 2 options ----------
    y_top_box = y - 5 * mm
    box_style = ParagraphStyle("box", parent=styles["Normal"],
                               fontName="Helvetica", fontSize=9, leading=12)

    txt1 = ("Reconnais que les r\u00e9parations ont \u00e9t\u00e9 effectu\u00e9es \u00e0 mon enti\u00e8re satisfaction "
            "et sont conformes \u00e0 la Fiche Travaux que j'ai approuv\u00e9. En consequence, je donne "
            "quitus \u00e0 l'entreprise ci-dessus et n'\u00e9mets aucune r\u00e9serve sur les travaux \u00e9xecut\u00e9s.")
    txt2 = ("Emets les r\u00e9serves pr\u00e9cis\u00e9es ci-dessous quant \u00e0 la r\u00e9alisation des travaux "
            "pr\u00e9conis\u00e9s et effectu\u00e9s.")

    cb_size = 4 * mm

    box_table = Table(
        [
            [Paragraph("", box_style), Paragraph(txt1, box_style)],
            [Paragraph("", box_style), Paragraph(txt2, box_style)],
        ],
        colWidths=[12 * mm, CONTENT_W - 12 * mm],
    )
    box_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (1, 0), (1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    bw2, bh2 = box_table.wrap(CONTENT_W, 400)
    box_table.drawOn(c, MARGIN_L, y_top_box - bh2)

    # Cases à cocher : on coche "satisfaction" par défaut
    row_h = bh2 / 2
    cb_x = MARGIN_L + 4 * mm
    cb_y_row1 = y_top_box - row_h / 2 - cb_size / 2
    cb_y_row2 = y_top_box - bh2 + row_h / 2 - cb_size / 2

    _draw_checkbox(c, cb_x, cb_y_row1, size=cb_size, checked=True)
    _draw_checkbox(c, cb_x, cb_y_row2, size=cb_size, checked=False)

    # ---------- Lignes pointillées des réserves ----------
    y_after_box = y_top_box - bh2 - 6 * mm
    reserves_lines = 3
    line_spacing = 6 * mm

    # Première ligne : on met la description des travaux
    for i in range(reserves_lines):
        ly = y_after_box - i * line_spacing
        if i == 0 and description:
            c.setFont("Helvetica", 12)
            c.drawString(MARGIN_L, ly, description[:80])
            text_w = c.stringWidth(description[:80], "Helvetica", 12)
            x_start = MARGIN_L + text_w + 4
        else:
            x_start = MARGIN_L
        c.setDash(1, 2)
        c.setLineWidth(0.5)
        c.line(x_start, ly - 1, MARGIN_L + CONTENT_W, ly - 1)
        c.setDash()

    # ---------- "Fait en 3 exemplaires..." (1) ----------
    y = y_after_box - reserves_lines * line_spacing - 4 * mm
    c.setFont("Helvetica", 10)
    lieu1 = ville or "............."
    date1 = date_str or "............"
    c.drawRightString(PAGE_W - MARGIN_R, y,
                      f"Fait en 3 exemplaires \u00e0 {lieu1}, le {date1}")

    # ---------- Signatures (1) ----------
    y -= 8 * mm
    left_x = MARGIN_L
    right_x = PAGE_W - MARGIN_R - 75 * mm
    c.setFont("Helvetica", 10)
    c.drawString(left_x, y, "Date et Signature du Client")
    c.line(left_x, y - 1,
           left_x + c.stringWidth("Date et Signature du Client", "Helvetica", 10),
           y - 1)
    c.drawString(right_x, y, "Date et Signature PROMULTITRAVAUX")
    c.line(right_x, y - 1,
           right_x + c.stringWidth("Date et Signature PROMULTITRAVAUX", "Helvetica", 10),
           y - 1)
    c.setFont("Helvetica", 8.5)
    c.drawString(right_x, y - 4 * mm,
                 "(Le Sous-traitant d\u00fbment mandat\u00e9 par PROMULTITRAVAUX)")

    # Cachet 1 - placé sous la mention "(Le Sous-traitant...)" pour ne pas la masquer
    if SIGNATURE_PATH.exists():
        sig_w = 55 * mm
        sig_h = sig_w * (302 / 636)
        # Décalé de 8*mm sous la mention (au lieu de 4*mm) + un peu plus à droite
        _draw_signature(c, str(SIGNATURE_PATH), right_x + 5 * mm, y - 12 * mm - sig_h, width=sig_w)
        sig_bottom = y - 12 * mm - sig_h
    else:
        sig_bottom = y - 12 * mm

    # ---------- Section "Procès-verbal de levée des réserves" ----------
    y = sig_bottom - 8 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN_L, y, "Proc\u00e8s-verbal de lev\u00e9e des r\u00e9serves")

    y -= 6 * mm
    _draw_dotted_line_with_text(
        c, MARGIN_L, y, CONTENT_W,
        text=f"Je soussign\u00e9(e) {nom_complet}",
        font="Helvetica", font_size=10,
    )

    y -= 6 * mm
    c.setFont("Helvetica", 10)
    c.drawString(MARGIN_L, y, "donne acte de la lev\u00e9e des r\u00e9serves ci-dessus mentionn\u00e9es.")

    y -= 8 * mm
    c.drawRightString(PAGE_W - MARGIN_R, y,
                      f"Fait en 3 exemplaires \u00e0 {lieu1}, le {date1}")

    y -= 8 * mm
    c.drawString(left_x, y, "Date et signature du Client")
    c.line(left_x, y - 1,
           left_x + c.stringWidth("Date et signature du Client", "Helvetica", 10),
           y - 1)
    c.drawString(right_x, y, "(Date et Signature du Sous-traitant)")
    c.line(right_x, y - 1,
           right_x + c.stringWidth("(Date et Signature du Sous-traitant)", "Helvetica", 10),
           y - 1)
    c.setFont("Helvetica", 8.5)
    c.drawString(right_x, y - 4 * mm, "(Le Sous-traitant d\u00fbment mandat\u00e9 par")
    c.drawString(right_x, y - 8 * mm, "PROMULTITRAVAUX)")

    if SIGNATURE_PATH.exists():
        sig_w = 55 * mm
        sig_h = sig_w * (302 / 636)
        # Décalé pour ne pas masquer "PROMULTITRAVAUX)"
        _draw_signature(c, str(SIGNATURE_PATH), right_x + 5 * mm, y - 18 * mm - sig_h, width=sig_w)

    c.save()
    return str(output_path)
