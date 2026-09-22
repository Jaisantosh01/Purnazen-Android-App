"""Razorpay order/signature/refund helpers.

Two modes, switched by configuration:
- **razorpay**: RAZORPAY_KEY_ID/SECRET set — orders are created against the
  Razorpay REST API (test keys = Razorpay sandbox) and signatures verified
  with the key secret, exactly like the checkout SDK contract.
- **local-sandbox**: no keys — orders are generated locally and signatures
  use a dev-only secret, so the full process → verify → refund flow still
  works offline (dev machines, CI, tests).

The signature scheme is Razorpay's: HMAC-SHA256 over "order_id|payment_id".
"""

import hashlib
import hmac
import logging
import time
import uuid

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RAZORPAY_API = "https://api.razorpay.com/v1"

_LOCAL_SANDBOX_SECRET = "local-sandbox-secret"


class ProviderError(Exception):
    """A Razorpay call that did not succeed, already mapped to an HTTP status
    the API can hand back: 400 for a rejected request, 500 for bad
    credentials, 502 for a malformed reply, 503 when Razorpay is unreachable."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def is_live() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


def _signature_secret() -> str:
    return settings.RAZORPAY_KEY_SECRET if is_live() else _LOCAL_SANDBOX_SECRET


def _request(method: str, path: str, json: dict | None = None) -> dict:
    """One authenticated Razorpay call. 4xx are never retried; timeouts and
    5xx get two more tries with backoff before giving up as 503."""
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = httpx.request(
                method,
                f"{RAZORPAY_API}{path}",
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                json=json,
                timeout=15,
            )
        except httpx.HTTPError as exc:
            last_exc = exc
            logger.warning("Razorpay %s %s attempt %d failed: %s", method, path, attempt + 1, exc)
            time.sleep(0.5 * (2 ** attempt))
            continue

        if response.status_code < 400:
            return response.json()
        if response.status_code == 401:
            logger.error("Razorpay rejected RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET (401)")
            raise ProviderError(500, "Payment provider misconfigured")
        if response.status_code < 500:
            try:
                description = response.json()["error"]["description"]
            except (ValueError, KeyError, TypeError):
                description = "Payment provider rejected the request"
            logger.warning("Razorpay %s %s -> %d: %s", method, path, response.status_code, description)
            raise ProviderError(400, description)
        last_exc = None
        logger.warning("Razorpay %s %s -> %d, attempt %d", method, path, response.status_code, attempt + 1)
        time.sleep(0.5 * (2 ** attempt))

    logger.error("Razorpay %s %s unreachable: %s", method, path, last_exc)
    raise ProviderError(503, "Payment provider unavailable, please try again")


def create_order(amount: float, currency: str = "INR", receipt: str = "") -> dict:
    """Create a payment order; amounts are rupees in, paise out to Razorpay."""
    if not is_live():
        return {
            "order_id": f"order_sbx_{uuid.uuid4().hex[:14]}",
            "key_id": "rzp_test_sandbox",
            "mode": "local-sandbox",
        }

    data = _request(
        "POST",
        "/orders",
        {"amount": int(round(amount * 100)), "currency": currency, "receipt": receipt},
    )
    if not data.get("id"):
        logger.error("Razorpay order response has no id: %s", data)
        raise ProviderError(502, "Payment provider returned an invalid order")
    return {
        "order_id": data["id"],
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


def fetch_payment(payment_id: str) -> dict:
    """The provider's view of a payment: `method` (card/upi/netbanking/
    wallet/…) and `status` (authorized/captured/refunded/…)."""
    if not is_live():
        return {"id": payment_id, "method": None, "status": "captured"}
    return _request("GET", f"/payments/{payment_id}")


def capture_payment(payment_id: str, amount: float, currency: str = "INR") -> dict:
    """Move an authorized payment to captured. Accounts with auto-capture on
    never need this; without it the money is released back after 5 days
    and a refund is impossible."""
    if not is_live():
        return {"id": payment_id, "status": "captured"}
    return _request(
        "POST",
        f"/payments/{payment_id}/capture",
        {"amount": int(round(amount * 100)), "currency": currency},
    )


def refund_payment(payment_id: str, amount: float | None = None) -> dict:
    """Refund a captured payment, fully (amount=None) or partially.
    Returns {id, amount (rupees), status}."""
    if not is_live():
        return {
            "id": f"rfnd_sbx_{uuid.uuid4().hex[:14]}",
            "amount": amount,
            "status": "processed",
        }
    body: dict = {"speed": "normal"}
    if amount is not None:
        body["amount"] = int(round(amount * 100))
    data = _request("POST", f"/payments/{payment_id}/refund", body)
    if not data.get("id"):
        logger.error("Razorpay refund response has no id: %s", data)
        raise ProviderError(502, "Payment provider returned an invalid refund")
    return {
        "id": data["id"],
        "amount": data["amount"] / 100 if data.get("amount") is not None else amount,
        "status": data.get("status"),
    }
