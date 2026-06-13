"""Razorpay order/signature helpers.

Two modes, switched by configuration:
- **razorpay**: RAZORPAY_KEY_ID/SECRET set — orders are created against the
  Razorpay REST API (test keys = Razorpay sandbox) and signatures verified
  with the key secret, exactly like the checkout SDK contract.
- **local-sandbox**: no keys — orders are generated locally and signatures
  use a dev-only secret, so the full process → verify flow still works
  offline (dev machines, CI, tests).

The signature scheme is Razorpay's: HMAC-SHA256 over "order_id|payment_id".
"""

import hashlib
import hmac
import uuid

import httpx

from app.core.config import settings

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"

_LOCAL_SANDBOX_SECRET = "local-sandbox-secret"


def is_live() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


def _signature_secret() -> str:
    return settings.RAZORPAY_KEY_SECRET if is_live() else _LOCAL_SANDBOX_SECRET


def create_order(amount: float, currency: str = "INR", receipt: str = "") -> dict:
    """Create a payment order; amounts are rupees in, paise out to Razorpay."""
    if not is_live():
        return {
            "order_id": f"order_sbx_{uuid.uuid4().hex[:14]}",
            "key_id": "rzp_test_sandbox",
            "mode": "local-sandbox",
        }

    response = httpx.post(
        RAZORPAY_ORDERS_URL,
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        json={
            "amount": int(round(amount * 100)),
            "currency": currency,
            "receipt": receipt,
        },
        timeout=15,
    )
    response.raise_for_status()
    return {
        "order_id": response.json()["id"],
        "key_id": settings.RAZORPAY_KEY_ID,
        "mode": "razorpay",
    }


def compute_signature(order_id: str, payment_id: str) -> str:
    return hmac.new(
        _signature_secret().encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    return hmac.compare_digest(compute_signature(order_id, payment_id), signature or "")
