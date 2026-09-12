"""Public, human-readable legal pages.

Play Console needs a privacy policy at a stable URL that a reviewer can open in
a browser with no login, and a data-deletion URL reachable without installing
the app. Both existed only as `GET /api/v1/content-pages/{type}` — JSON, from an
API. A reviewer opening that sees a JSON envelope, not a policy.

These routes render the same `content_pages` rows as HTML, unauthenticated, at
root-level URLs (`/legal/privacy`, `/legal/terms`, `/legal/delete-account`) so
they read like pages rather than API calls. The admin console stays the single
place the text is edited; nothing here duplicates the content.
"""
from __future__ import annotations

import html
import re

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.content_page import ContentPage
from app.models.role import Role
from app.models.support_contact import SupportContact

router = APIRouter(prefix="/legal", tags=["Legal"], include_in_schema=False)

# Public-facing role whose copy is the canonical one; staff-role variants of the
# same page exist for the doctor and admin apps.
_PUBLIC_ROLE = "patient"

_PAGE_CSS = """
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0 20px 72px;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
    color: #1a1c22;
    background: #ffffff;
  }
  .wrap { max-width: 46rem; margin: 0 auto; }
  header { padding: 40px 0 20px; border-bottom: 1px solid #e4e5ea; margin-bottom: 28px; }
  h1 { font-size: 1.85rem; line-height: 1.2; margin: 0 0 8px; }
  .meta { font-size: 0.85rem; color: #6b7080; margin: 0; }
  h2 { font-size: 1.25rem; margin: 34px 0 10px; line-height: 1.3; }
  h3 { font-size: 1.05rem; margin: 26px 0 8px; }
  p, li { margin: 0 0 14px; }
  ul { padding-left: 22px; margin: 0 0 16px; }
  a { color: #1d4ed8; }
  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid #e4e5ea;
           font-size: 0.85rem; color: #6b7080; }
  footer a { margin-right: 16px; }
  @media (prefers-color-scheme: dark) {
    body { background: #14161c; color: #e8e9ee; }
    header, footer { border-color: #2b2f3a; }
    .meta, footer { color: #9aa0b0; }
    a { color: #8ab0ff; }
  }
"""


def _render_markdownish(text: str) -> str:
    """Render the small subset of Markdown the admin console actually produces.

    Deliberately not a Markdown dependency: the input is admin-authored copy
    with headings, paragraphs, bullets and the occasional bold run. Everything
    is HTML-escaped first, so a stray `<script>` in the database renders as
    text — these pages are public and unauthenticated.
    """
    out: list[str] = []
    in_list = False

    def close_list():
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    for raw in text.replace("\r\n", "\n").split("\n"):
        line = html.escape(raw.strip())
        if not line:
            close_list()
            continue

        # **bold** and *italic*, applied after escaping so the markers cannot
        # be used to inject tags.
        line = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", line)
        line = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<em>\1</em>", line)

        heading = re.match(r"^(#{1,3})\s+(.*)$", line)
        if heading:
            close_list()
            level = min(len(heading.group(1)) + 1, 4)  # '#' -> h2, page has one h1
            out.append(f"<h{level}>{heading.group(2)}</h{level}>")
            continue

        bullet = re.match(r"^[-*•]\s+(.*)$", line)
        if bullet:
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{bullet.group(1)}</li>")
            continue

        close_list()
        out.append(f"<p>{line}</p>")

    close_list()
    return "\n".join(out)


def _shell(title: str, meta: str, body_html: str) -> HTMLResponse:
    return HTMLResponse(
        "<!doctype html>\n"
        '<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{html.escape(title)} · Purnazen</title>"
        f"<style>{_PAGE_CSS}</style></head><body><div class=\"wrap\">"
        f"<header><h1>{html.escape(title)}</h1>"
        f'<p class="meta">{html.escape(meta)}</p></header>'
        f"{body_html}"
        '<footer><a href="/legal/privacy">Privacy policy</a>'
        '<a href="/legal/terms">Terms of use</a>'
        '<a href="/legal/delete-account">Delete your account</a></footer>'
        "</div></body></html>"
    )


def _latest_page(db: Session, content_type: str) -> ContentPage | None:
    """The public copy of a content page: the patient-role version when there is
    one, otherwise the most recent active row of that type."""
    base = db.query(ContentPage).filter(
        ContentPage.type == content_type,
        ContentPage.is_active.is_(True),
    )
    patient = (
        base.join(Role, ContentPage.role_id == Role.id)
        .filter(Role.name == _PUBLIC_ROLE)
        .order_by(ContentPage.created_at.desc())
        .first()
    )
    return patient or base.order_by(ContentPage.created_at.desc()).first()


def _missing(title: str) -> HTMLResponse:
    resp = _shell(
        title,
        "Not published yet",
        "<p>This page has not been published yet. Please check back shortly, or "
        'reach us through Help &amp; Support in the Purnazen app.</p>',
    )
    resp.status_code = 404
    return resp


def _support_email(db: Session) -> str | None:
    row = (
        db.query(SupportContact)
        .filter(
            SupportContact.contact_type == "email",
            SupportContact.is_active.is_(True),
            SupportContact.value.isnot(None),
        )
        .order_by(SupportContact.sort_order)
        .first()
    )
    return row.value if row else None


@router.get("", response_class=HTMLResponse, summary="Legal index")
def legal_index():
    return _shell(
        "Legal",
        "Purnazen",
        "<ul>"
        '<li><a href="/legal/privacy">Privacy policy</a></li>'
        '<li><a href="/legal/terms">Terms of use</a></li>'
        '<li><a href="/legal/delete-account">Delete your account and data</a></li>'
        "</ul>",
    )


@router.get("/privacy", response_class=HTMLResponse, summary="Privacy policy")
def privacy_policy(db: Session = Depends(get_db)):
    page = _latest_page(db, "privacy")
    if not page:
        return _missing("Privacy policy")
    updated = page.updated_at or page.created_at
    meta = f"Version {page.version}"
    if updated:
        meta += f" · last updated {updated.date().isoformat()}"
    return _shell(page.title or "Privacy policy", meta, _render_markdownish(page.content))


@router.get("/terms", response_class=HTMLResponse, summary="Terms of use")
def terms_of_use(db: Session = Depends(get_db)):
    page = _latest_page(db, "terms")
    if not page:
        return _missing("Terms of use")
    updated = page.updated_at or page.created_at
    meta = f"Version {page.version}"
    if updated:
        meta += f" · last updated {updated.date().isoformat()}"
    return _shell(page.title or "Terms of use", meta, _render_markdownish(page.content))


@router.get(
    "/delete-account",
    response_class=HTMLResponse,
    summary="Account and data deletion",
)
def delete_account(db: Session = Depends(get_db)):
    """The URL Play Console's data-deletion field points at.

    Play requires this to be reachable without installing the app, to say what
    is deleted, what is kept, and for how long. Deletion is a request rather
    than a self-service wipe because the records have clinical value and Indian
    medical-records retention applies — which is exactly the sort of thing this
    page has to state rather than imply.
    """
    email = _support_email(db)
    contact = (
        f'<p>If you cannot sign in, email <a href="mailto:{html.escape(email)}">'
        f"{html.escape(email)}</a> from the address on your account and we will "
        "action the request.</p>"
        if email
        else "<p>If you cannot sign in, use the Help &amp; Support screen in the "
        "app to reach us and we will action the request.</p>"
    )

    body = f"""
<p>You can ask us to delete your Purnazen account and the data held against it
at any time. You do not need the app installed to make the request.</p>

<h2>How to request deletion</h2>
<ul>
  <li><strong>In the app:</strong> Profile → Settings → Delete account.</li>
  <li><strong>Without the app:</strong> see the contact details below.</li>
</ul>
{contact}

<h2>What is deleted</h2>
<ul>
  <li>Your profile: name, email address, phone number, date of birth, gender,
      height and weight, and your profile photo.</li>
  <li>Your saved addresses and app preferences.</li>
  <li>Face and tongue scan photographs, and the scores derived from them.</li>
  <li>Your wellness and relief session history.</li>
  <li>Notification tokens for your devices, so push notifications stop.</li>
  <li>Your sign-in credentials. Every existing session stops working
      immediately.</li>
</ul>

<h2>What is kept, and for how long</h2>
<ul>
  <li><strong>Clinical records</strong> — consultation notes, prescriptions and
      the appointments they relate to — are retained where a doctor has
      recorded them, for as long as medical-records law requires. They are no
      longer linked to a usable account.</li>
  <li><strong>Payment records</strong> are retained for the period tax and
      accounting law requires. Card details are never held by us: payments are
      processed by Razorpay.</li>
  <li><strong>Anonymous, aggregated statistics</strong> that cannot identify
      you.</li>
</ul>

<h2>How long it takes</h2>
<p>Requests are actioned within <strong>30 days</strong>. You will receive
confirmation at the email address on the account once it is done.</p>

<h2>Questions</h2>
<p>See the <a href="/legal/privacy">privacy policy</a> for the full account of
what we collect and why.</p>
"""
    return _shell("Delete your account", "Purnazen account and data deletion", body)
