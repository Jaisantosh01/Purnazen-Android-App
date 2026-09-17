"""Renders the health-report payload (HealthReportService.build) as a one-page
PDF. Same data as the screen, so the two can't disagree."""
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

DASH = "—"
BRAND = colors.HexColor("#0E9F6E")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
RULE = colors.HexColor("#E5E7EB")


def _v(x):
    return DASH if x in (None, "") else str(x)


def _score(x):
    return DASH if x is None else str(round(x))


def render_pdf(report: dict) -> bytes:
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=20, textColor=INK, alignment=0, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=ss["Normal"], fontSize=9, textColor=MUTED, spaceAfter=10)
    h2 = ParagraphStyle("h2", parent=ss["Normal"], fontSize=9, textColor=BRAND, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9.5, textColor=INK, leading=13)
    note = ParagraphStyle("note", parent=ss["Normal"], fontSize=8, textColor=MUTED, leading=11, spaceBefore=14)

    def rows(pairs):
        t = Table([[Paragraph(k, body), Paragraph(_v(v), body)] for k, v in pairs], colWidths=[55 * mm, 115 * mm])
        t.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
            ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ]))
        return t

    p, vit, med = report["patient"], report["vitals"], report["medical"]
    th, ap = report["therapy"], report["appointments"]

    story = [
        Paragraph("Purnazen health report", h1),
        Paragraph(f"Generated {report['generatedAt']} · Not a medical diagnosis", sub),
        Paragraph("PATIENT", h2),
        rows([
            ("Name", p.get("name")),
            ("Age / Gender", f"{_v(p.get('age'))} / {_v(p.get('gender'))}"),
            ("Blood group", p.get("bloodGroup")),
            ("Height / Weight", f"{_v(vit.get('heightCm'))} cm / {_v(vit.get('weightKg'))} kg"),
            ("BMI", f"{vit['bmi']} ({vit['bmiBand']})" if vit.get("bmi") is not None else None),
        ]),
        Paragraph("MEDICAL BACKGROUND", h2),
        rows([("Allergies", med.get("allergies")), ("Conditions", med.get("conditions")), ("Medication", med.get("medications"))]),
        Paragraph("WELLNESS & THERAPY", h2),
        rows([
            ("Completed sessions", th.get("completedSessions")),
            ("Total minutes", th.get("totalMinutes")),
            ("Current streak", f"{th.get('streakDays', 0)} day(s)"),
        ]),
    ]

    if th.get("recent"):
        story.append(Spacer(1, 4))
        story.append(rows([
            (r.get("date") or DASH, f"{_v(r.get('title'))} · {_v(r.get('sessionType')).title()} · {_v(r.get('status')).replace('_', ' ')}")
            for r in th["recent"]
        ]))

    story += [
        Paragraph("CONSULTATIONS", h2),
        rows([("Completed", ap.get("completed")), ("Upcoming", ap.get("upcoming")), ("Last visit", ap.get("lastVisit"))]),
    ]

    face = report.get("latestFaceScan")
    if face:
        story += [Paragraph("LATEST FACE SCAN", h2), rows([
            ("Taken on", (face.get("takenAt") or "")[:10]),
            ("Wellness score", _score(face.get("wellnessScore"))),
            ("Hydration", _score(face.get("hydrationScore"))),
            ("Glow", _score(face.get("glowScore"))),
            ("Skin age", face.get("skinAge")),
        ])]
    tongue = report.get("latestTongueScan")
    if tongue:
        story += [Paragraph("LATEST TONGUE SCAN", h2), rows([
            ("Taken on", (tongue.get("takenAt") or "")[:10]),
            ("Tongue colour", tongue.get("tongueColour")),
            ("Coat colour", tongue.get("coatColour")),
            ("Coat thickness", tongue.get("coatThickness")),
            ("Moisture", tongue.get("moisture")),
            ("Shape", tongue.get("shape")),
        ])]

    story.append(Paragraph("This summary is generated from your activity in Purnazen and is not a medical diagnosis.", note))

    buf = BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                      title="Purnazen health report", author="Purnazen").build(story)
    return buf.getvalue()
