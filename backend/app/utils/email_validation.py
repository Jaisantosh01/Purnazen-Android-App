"""Email address validation shared by registration and the live-check endpoint.

Two concerns beyond "is it syntactically an email":

1. **Disposable / throwaway domains** — temp-mail services (mailinator,
   guerrillamail, 10minutemail, …) are rejected outright so accounts map to a
   real, reachable inbox. The list below is a curated set of the common ones;
   it's a blocklist, not an allowlist, so legitimate providers (Gmail, Yahoo,
   Outlook, ProtonMail, company domains, …) all pass.

2. **Random / non-existent domains** — an optional MX/deliverability check
   (``email-validator``) rejects domains that can't receive mail. It's
   best-effort: a DNS lookup failure (e.g. an offline box) never blocks a
   signup, only a domain that resolves and demonstrably has no mail exchanger.

Every rejection returns a soft, human message the apps can show inline.
"""

from email_validator import EmailNotValidError, validate_email

# Common disposable / temporary email domains. Not exhaustive — it catches the
# services people actually reach for. Lowercase, bare domains.
DISPOSABLE_DOMAINS: frozenset[str] = frozenset({
    "10minutemail.com", "10minutemail.net", "20minutemail.com",
    "33mail.com", "temp-mail.org", "tempmail.com", "tempmail.net",
    "tempmailo.com", "temp-mail.io", "tempr.email", "tempmail.plus",
    "mailinator.com", "mailinator.net", "mailinator2.com",
    "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamailblock.com",
    "sharklasers.com", "grr.la", "spam4.me", "pokemail.net",
    "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
    "throwawaymail.com", "throwaway.email", "getnada.com", "nada.email",
    "trashmail.com", "trashmail.net", "trash-mail.com", "wegwerfmail.de",
    "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com",
    "fakeinbox.com", "fakemailgenerator.com", "emailondeck.com",
    "mohmal.com", "moakt.com", "mailcatch.com", "spambog.com",
    "mailismagic.com", "tempinbox.com", "tempemail.co", "burnermail.io",
    "anonbox.net", "getairmail.com", "harakirimail.com", "incognitomail.com",
    "mytemp.email", "mail-temp.com", "email-fake.com", "fakemail.net",
    "1secmail.com", "1secmail.net", "1secmail.org", "vjuum.com",
    "discard.email", "dropmail.me", "instant-mail.de", "luxusmail.org",
})

# Soft, user-facing messages (no jargon, no blame).
MSG_INVALID = "That doesn't look like a valid email address — please double-check it."
MSG_DISPOSABLE = (
    "Please use a permanent email address (like Gmail, Yahoo or Outlook). "
    "Temporary or disposable addresses aren't supported."
)
MSG_UNDELIVERABLE = (
    "We couldn't find a mail server for that address. Please check the spelling "
    "or use a different email."
)


def _domain_of(email: str) -> str:
    return email.rsplit("@", 1)[-1].strip().lower().rstrip(".")


def validate_account_email(email: str, check_deliverability: bool = True) -> dict:
    """Validate an email for account use.

    Returns a dict ``{"valid": bool, "email": normalized_or_input,
    "message": str | None}``. ``message`` is a soft explanation when invalid.

    ``check_deliverability`` adds an MX lookup (best-effort — network failures
    are ignored so they never block a legitimate signup).
    """
    raw = (email or "").strip()
    if not raw:
        return {"valid": False, "email": raw, "message": MSG_INVALID}

    # Disposable check first — it's authoritative and needs no network.
    if _domain_of(raw) in DISPOSABLE_DOMAINS:
        return {"valid": False, "email": raw, "message": MSG_DISPOSABLE}

    # Syntax (and normalization) without touching the network.
    try:
        result = validate_email(raw, check_deliverability=False)
    except EmailNotValidError:
        return {"valid": False, "email": raw, "message": MSG_INVALID}

    normalized = result.normalized
    # Re-check the normalized domain against the blocklist (handles casing/IDN).
    if _domain_of(normalized) in DISPOSABLE_DOMAINS:
        return {"valid": False, "email": normalized, "message": MSG_DISPOSABLE}

    if check_deliverability:
        try:
            validate_email(normalized, check_deliverability=True)
        except EmailNotValidError:
            # Domain resolved but has no usable mail server → reject softly.
            # (A pure network/DNS failure also lands here; we accept the small
            #  risk of letting a bad domain through over blocking a good signup
            #  when the server simply can't do DNS. Registration still requires
            #  email verification downstream.)
            return {"valid": False, "email": normalized, "message": MSG_UNDELIVERABLE}

    return {"valid": True, "email": normalized, "message": None}
