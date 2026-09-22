from sqlalchemy.orm import Session

from app.models.payment import Payment


class PaymentRepository:

    @staticmethod
    def create(db: Session, **fields) -> Payment:
        payment = Payment(**fields)
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def get_by_order_id(db: Session, order_id: str) -> Payment | None:
        return db.query(Payment).filter_by(order_id=order_id).first()

    @staticmethod
    def get_refundable_by_appointment(db: Session, appointment_id) -> Payment | None:
        """The payment still holding money for this appointment, if any."""
        return (
            db.query(Payment)
            .filter(
                Payment.appointment_id == appointment_id,
                Payment.status.in_(["paid", "partially_refunded"]),
            )
            .order_by(Payment.created_at.desc())
            .first()
        )
