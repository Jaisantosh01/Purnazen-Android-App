import logging

from sqlalchemy.orm import Session

from app.core import payment_provider
from app.core.payment_provider import ProviderError
from app.models.appointment import Appointment
from app.models.user import User
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import (
    ProcessPaymentRequest,
    RefundPaymentRequest,
    VerifyPaymentRequest,
)
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class PaymentService:

    @staticmethod
    def process(db: Session, user: User, data: ProcessPaymentRequest):
        appointment = None
        amount = data.amount
        if data.appointment_id is not None:
            appointment = db.get(Appointment, data.appointment_id)
            if not appointment or appointment.user_id != user.id:
                return {"success": False, "message": "Appointment not found"}, 404
            if appointment.payment_status == "paid":
                return {
                    "success": False,
                    "message": "This appointment is already paid",
                }, 400
            # The fee-plus-GST total is settled at booking time and stored on the
            # appointment, so charge that rather than the client's figure: the
            # order can then never drift from what the app displayed, and the
            # amount isn't something a caller can talk down.
            if appointment.total_amount is not None:
                amount = float(appointment.total_amount)

        try:
            order = payment_provider.create_order(
                amount,
                data.currency,
                receipt=f"apt-{data.appointment_id}" if data.appointment_id else "adhoc",
            )
        except ProviderError as exc:
            return {"success": False, "message": exc.message}, exc.status_code

        payment = PaymentRepository.create(
            db,
            user_id=user.id,
            appointment_id=appointment.id if appointment else None,
            amount=amount,
            currency=data.currency,
            provider="razorpay",
            order_id=order["order_id"],
            method=data.method,
            status="created",
        )

        response = {
            "payment": payment.to_dict(),
            "orderId": order["order_id"],
            "keyId": order["key_id"],
            "amount": amount,
            "currency": data.currency,
            "mode": order["mode"],
        }

        # Without provider keys there is no checkout SDK to produce the
        # signature, so the local sandbox hands the client a valid pair —
        # the verify endpoint then exercises the exact same path as live.
        if order["mode"] == "local-sandbox":
            sandbox_payment_id = f"pay_sbx_{payment.id.hex}"
            response["sandboxPaymentId"] = sandbox_payment_id
            response["sandboxSignature"] = payment_provider.compute_signature(
                order["order_id"], sandbox_payment_id
            )

        return {
            "success": True,
            "message": "Payment order created",
            "data": response,
        }, 201

    @staticmethod
    def verify(db: Session, user: User, data: VerifyPaymentRequest):
        payment = PaymentRepository.get_by_order_id(db, data.order_id)
        if not payment or payment.user_id != user.id:
            return {"success": False, "message": "Payment not found"}, 404

        if payment.status == "paid":
            return {
                "success": True,
                "message": "Payment already verified",
                "data": {"payment": payment.to_dict()},
            }, 200

        if not payment_provider.verify_signature(
            data.order_id, data.payment_id, data.signature
        ):
            payment.status = "failed"
            if payment.appointment:
                payment.appointment.payment_status = "unpaid"
            db.commit()
            ref = payment.appointment.reference if payment.appointment else data.order_id
            NotificationService.notify_safely(
                db, user.id, category="payment", event="payment_failed",
                title="Payment failed",
                body=f"Your payment for {ref} could not be verified. Please try again.",
                data={"orderId": data.order_id},
            )
            return {
                "success": False,
                "message": "Payment verification failed",
            }, 400

        payment.status = "paid"
        payment.payment_id = data.payment_id
        # The signature is the proof of payment; the provider lookup only
        # enriches the row (real method: card/upi/netbanking/wallet) and
        # captures accounts that have auto-capture off. Losing it must not
        # un-pay a verified payment, so it is best-effort.
        try:
            details = payment_provider.fetch_payment(data.payment_id)
            payment.method = details.get("method") or payment.method
            if details.get("status") == "authorized":
                payment_provider.capture_payment(
                    data.payment_id, float(payment.amount), payment.currency
                )
        except ProviderError as exc:
            logger.warning("Post-verify lookup for %s failed: %s", data.payment_id, exc.message)
        if payment.appointment:
            payment.appointment.payment_status = "paid"
        db.commit()
        db.refresh(payment)

        appointment = payment.appointment
        ref = appointment.reference if appointment else data.order_id
        amount = f"₹{payment.amount}" if payment.amount is not None else ""
        NotificationService.notify_safely(
            db, user.id, category="payment", event="payment_paid",
            title="Payment successful",
            body=f"Payment {amount} for {ref} was received successfully.".replace("  ", " "),
            data={
                "orderId": data.order_id,
                **({"appointmentId": str(appointment.id)} if appointment else {}),
            },
        )
        # The doctor also learns the consultation is now paid for
        if appointment and appointment.doctor:
            NotificationService.notify_safely(
                db, appointment.doctor.user_id, category="payment", event="payment_paid",
                title="Consultation paid",
                body=f"{appointment.user.full_name or 'The patient'} paid {amount} for {ref}.".replace("  ", " "),
                data={"appointmentId": str(appointment.id)},
            )

        return {
            "success": True,
            "message": "Payment verified successfully",
            "data": {"payment": payment.to_dict()},
        }, 200

    @staticmethod
    def refund(db: Session, user: User, data: RefundPaymentRequest):
        appointment = db.get(Appointment, data.appointment_id)
        if not appointment or appointment.user_id != user.id:
            return {"success": False, "message": "Appointment not found"}, 404
        if appointment.status == "completed":
            return {"success": False, "message": "Completed consultations cannot be refunded"}, 400

        payment = PaymentRepository.get_refundable_by_appointment(db, appointment.id)
        if not payment:
            return {"success": False, "message": "No refundable payment for this appointment"}, 400

        remaining = float(payment.amount) - float(payment.refunded_amount or 0)
        amount = data.amount if data.amount is not None else remaining
        if amount > remaining + 1e-6:
            return {
                "success": False,
                "message": f"Only ₹{remaining:.2f} is left to refund on this payment",
            }, 400

        try:
            refund = payment_provider.refund_payment(payment.payment_id, amount)
        except ProviderError as exc:
            return {"success": False, "message": exc.message}, exc.status_code

        payment.refund_id = refund["id"]
        payment.refunded_amount = float(payment.refunded_amount or 0) + amount
        full = float(payment.refunded_amount) >= float(payment.amount) - 1e-6
        payment.status = "refunded" if full else "partially_refunded"
        # A full refund is the patient walking away: the slot opens up again.
        if full:
            appointment.payment_status = "refunded"
            appointment.status = "cancelled"
        db.commit()
        db.refresh(payment)

        ref = appointment.reference
        NotificationService.notify_safely(
            db, user.id, category="payment", event="payment_refunded",
            title="Refund initiated",
            body=f"₹{amount:.2f} for {ref} is on its way back to your payment method (5-7 working days).",
            data={"appointmentId": str(appointment.id), "refundId": refund["id"]},
        )
        if full and appointment.doctor:
            NotificationService.notify_safely(
                db, appointment.doctor.user_id, category="appointment", event="appointment_cancelled",
                title="Appointment cancelled",
                body=f"{appointment.user.full_name or 'The patient'} cancelled {ref} and was refunded.",
                data={"appointmentId": str(appointment.id)},
            )

        return {
            "success": True,
            "message": "Refund initiated",
            "data": {"payment": payment.to_dict(), "refund": refund},
        }, 200
