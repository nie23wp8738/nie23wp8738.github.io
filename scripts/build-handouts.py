"""Rebuild the original English course handouts from src/data/lessons.json.

Requires Python, reportlab and the DejaVu fonts (set DEJAVU_FONT_DIR if needed).
"""
from html import escape
import json
import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = Path(os.environ.get('DEJAVU_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
for name, file in [('HandoutSerif', 'DejaVuSerif.ttf'), ('HandoutBold', 'DejaVuSerif-Bold.ttf'),
                   ('HandoutSans', 'DejaVuSans.ttf'), ('HandoutSansBold', 'DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))

INK = colors.HexColor('#162530')
MUTED = colors.HexColor('#495761')
LINE = colors.HexColor('#bac2c7')
WIDTH, HEIGHT = A4
MARGIN = 46
AVAILABLE = WIDTH - 2 * MARGIN


def body(canvas, text, y, *, font='HandoutSerif', size=10.25, leading=15, color=INK, x=MARGIN, width=AVAILABLE):
    style = ParagraphStyle('paragraph', fontName=font, fontSize=size, textColor=color, leading=leading,
                           alignment=TA_LEFT, splitLongWords=False)
    paragraph = Paragraph(escape(text), style)
    _, height = paragraph.wrap(width, HEIGHT)
    paragraph.drawOn(canvas, x, y - height)
    return y - height


def frame(canvas, lesson, page):
    canvas.setFillColor(INK)
    canvas.setFont('HandoutSansBold', 9)
    canvas.drawString(MARGIN, HEIGHT - 38, 'DR.WANG')
    canvas.setFont('HandoutSans', 9)
    canvas.drawRightString(WIDTH - MARGIN, HEIGHT - 38, lesson['trackEn'] + '   /   Course handout')
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(.6)
    canvas.line(MARGIN, HEIGHT - 48, WIDTH - MARGIN, HEIGHT - 48)
    canvas.line(MARGIN, 44, WIDTH - MARGIN, 44)
    canvas.setFillColor(MUTED)
    canvas.setFont('HandoutSans', 8.25)
    canvas.drawString(MARGIN, 30, lesson['titleEn'])
    canvas.drawRightString(WIDTH - MARGIN, 30, f'{page} / 3')


def build(lesson):
    output = ROOT / 'public' / 'handouts' / (lesson['slug'] + '.pdf')
    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = Canvas(str(output), pagesize=A4, pageCompression=1, invariant=1)
    pdf.setAuthor('DR.WANG')
    pdf.setTitle(lesson['titleEn'])
    frame(pdf, lesson, 1)
    y = body(pdf, lesson['titleEn'], HEIGHT - 67, font='HandoutBold', size=24, leading=31)
    y = body(pdf, lesson['aim'], y - 9, font='HandoutSans', size=10, leading=15, color=MUTED) - 21
    for section in lesson['sections']:
        y = body(pdf, section['headingEn'], y, font='HandoutBold', size=14, leading=18) - 4
        y = body(pdf, section['ideaEn'], y, size=10.25, leading=15, color=MUTED) - 6
        y = body(pdf, section['exampleEn'], y, font='HandoutSans', size=10.5, leading=16) - 5
        y = body(pdf, section['workEn'], y) - 6
        y = body(pdf, section['formulaEn'], y, font='HandoutSans', size=10.5, leading=16, x=MARGIN+11,
                 width=AVAILABLE-11) - 17
    if y < 48:
        raise ValueError(f"Page 1 overflow in {lesson['slug']}")
    pdf.showPage()
    for i, task in enumerate(lesson['practice'], start=1):
        frame(pdf, lesson, i+1)
        y = body(pdf, f'Independent practice {i}', HEIGHT - 74, font='HandoutBold', size=22, leading=30)
        y = body(pdf, task['promptEn'], y - 14, size=13, leading=21)
        body(pdf, 'Working', y - 33, font='HandoutSans', size=9, leading=13, color=MUTED)
        pdf.setStrokeColor(LINE)
        for row in range(8):
            yy = y - 75 - row * 36
            pdf.line(MARGIN, yy, WIDTH - MARGIN, yy)
        y = body(pdf, 'Check after solving', 140, font='HandoutSansBold', size=10, leading=14)
        body(pdf, task['checkEn'], y - 5, size=10.25, leading=15, color=MUTED)
        pdf.showPage()
    pdf.save()


if __name__ == '__main__':
    for lesson in json.loads((ROOT / 'src/data/lessons.json').read_text()):
        build(lesson)
