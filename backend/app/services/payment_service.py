from sqlalchemy.orm import Session

from app.core import payment_provider
from app.models.appointment import Appointment
from app.models.user import User
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import ProcessPaymentRequest, VerifyPaymentRequest


class PaymentService:

    @staticmethod
    def process(db: Session, user: User, data: ProcessPaymentRequest):
        appointment = None
        if data.appointment_id is not None:
            appointment = db.get(Appointment, data.appointment_id)
            if not appointment or appointment.user_id != user.id:
                return {"success": False, "message": "Appointment not found"}, 404
            if appointment.payment_status == "paid":
                return {
                    "success": False,
                    "message": "This appointment is already paid",
                }, 400

        order = payment_provider.create_order(
            data.amount,
            data.currency,
            receipt=f"apt-{data.appointment_id}" if data.appointment_id else "adhoc",
        )

        payment = PaymentRepository.create(
            db,
            user_id=user.id,
            appointment_id=appointment.id if appointment else None,
            amount=data.amount,
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
            "amount": data.amount,
            "currency": data.currency,
            "mode": order["mode"],
        }

        # Without provider keys there is no checkout SDK to produce the
        # signature, so the local sandbox hands the client a valid pair —
        # the verify endpoint then exercises the exact same path as live.
        if order["mode"] == "local-sandbox":
            sandbox_payment_id = f"pay_sbx_{payment.id:08d}"
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
            db.commit()
            return {
                "success": False,
                "message": "Payment verification failed",
            }, 400

        payment.status = "paid"
        payment.payment_id = data.payment_id
        if payment.appointment:
            payment.appointment.payment_status = "paid"
        db.commit()
        db.refresh(payment)

        return {
            "success": True,
            "message": "Payment verified successfully",
            "data": {"payment": payment.to_dict()},
        }, 200
