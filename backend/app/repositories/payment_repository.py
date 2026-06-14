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
