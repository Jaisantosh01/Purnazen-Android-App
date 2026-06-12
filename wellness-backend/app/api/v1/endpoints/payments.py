from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.payment import ProcessPaymentRequest, VerifyPaymentRequest
from app.services.payment_service import PaymentService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post(
    "/process",
    status_code=201,
    summary="Create a payment order",
    description=(
        "Creates a Razorpay order for an appointment (test keys = Razorpay "
        "sandbox; without keys a local sandbox order is generated and the "
        "response includes `sandboxPaymentId`/`sandboxSignature` to complete "
        "the flow via `/payments/verify`)."
    ),
)
def process_payment(
    body: ProcessPaymentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = PaymentService.process(db, user, body)

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], response["data"], status_code)


@router.post(
    "/verify",
    summary="Verify a payment signature",
    description=(
        "Verifies the HMAC signature returned by the checkout. On success the "
        "payment and its appointment are marked paid; on mismatch the payment "
        "is marked failed and the appointment stays unpaid."
    ),
)
def verify_payment(
    body: VerifyPaymentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = PaymentService.verify(db, user, body)

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], response["data"], status_code)
