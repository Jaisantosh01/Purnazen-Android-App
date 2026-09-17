"""Time-based one-time passwords (RFC 6238), as used by Google Authenticator,
Microsoft Authenticator, 1Password and friends: HMAC-SHA1, 6 digits, 30 s.

Small enough to own rather than add a dependency; covered by the RFC 6238
test vectors in tests/test_mfa.py.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote, urlencode

PERIOD = 30
DIGITS = 6
# Accept the previous and next step too: phone clocks drift.
WINDOW = 1


def generate_secret() -> str:
    """160 random bits, base32 without padding (what authenticator apps expect)."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _key(secret_b32: str) -> bytes:
    padded = secret_b32.upper() + "=" * (-len(secret_b32) % 8)
    return base64.b32decode(padded)


def hotp(key: bytes, counter: int, digits: int = DIGITS, digest=hashlib.sha1) -> str:
    mac = hmac.new(key, struct.pack(">Q", counter), digest).digest()
    offset = mac[-1] & 0x0F
    code = struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10 ** digits)).zfill(digits)


def current_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // PERIOD)


def verify(secret_b32: str, code: str, last_used_step: int | None = None,
           now: float | None = None) -> int | None:
    """Return the matched time step, or None.

    A step at or before `last_used_step` is refused, so a code that was just
    used (or observed) cannot be replayed within its 90-second window.
    """
    code = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(code) != DIGITS:
        return None
    key = _key(secret_b32)
    step = current_step(now)
    for candidate in range(step - WINDOW, step + WINDOW + 1):
        if last_used_step is not None and candidate <= last_used_step:
            continue
        if hmac.compare_digest(hotp(key, candidate), code):
            return candidate
    return None


def provisioning_uri(secret_b32: str, account: str, issuer: str) -> str:
    label = quote(f"{issuer}:{account}")
    query = urlencode({"secret": secret_b32, "issuer": issuer, "algorithm": "SHA1",
                       "digits": DIGITS, "period": PERIOD})
    return f"otpauth://totp/{label}?{query}"
