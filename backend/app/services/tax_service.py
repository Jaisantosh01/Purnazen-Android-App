from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.tax_setting import TaxSetting

# Used only to seed the singleton row the first time it is read; after that the
# admin panel owns the value and nothing in the codebase assumes 18%.
DEFAULT_GST_PERCENTAGE = Decimal("18")

_MONEY = Decimal("0.01")


class TaxService:
    """Single source of truth for GST amounts.

    Every screen that shows a fee (booking summary, checkout, appointment
    detail) and the payment order itself go through ``breakdown``/``for_base``,
    so the base fee, the GST line and the total can never disagree by a rounding
    unit. Money is quantized to 2dp with ROUND_HALF_UP — Python's default
    banker's rounding would make ₹0.005 cases drift away from what the client
    displays.
    """

    @staticmethod
    def get_settings(db: Session) -> TaxSetting:
        row = db.get(TaxSetting, 1)
        if row is None:
            row = TaxSetting(id=1, gst_percentage=DEFAULT_GST_PERCENTAGE)
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    @staticmethod
    def gst_percentage(db: Session) -> Decimal:
        row = TaxService.get_settings(db)
        return Decimal(str(row.gst_percentage if row.gst_percentage is not None else 0))

    @staticmethod
    def money(value) -> Decimal:
        return Decimal(str(value if value is not None else 0)).quantize(
            _MONEY, rounding=ROUND_HALF_UP
        )

    @staticmethod
    def gst_amount(base, percentage) -> Decimal:
        """GST payable on ``base`` at ``percentage``, rounded to 2dp."""
        base_amount = Decimal(str(base if base is not None else 0))
        pct = Decimal(str(percentage if percentage is not None else 0))
        return TaxService.money(base_amount * pct / Decimal("100"))

    @staticmethod
    def for_base(base, percentage) -> dict:
        """Breakdown for an already-known rate (e.g. an appointment snapshot)."""
        base_amount = TaxService.money(base)
        pct = Decimal(str(percentage if percentage is not None else 0))
        gst = TaxService.gst_amount(base_amount, pct)
        return {
            "baseAmount": float(base_amount),
            "gstPercentage": float(pct),
            "gstAmount": float(gst),
            "totalAmount": float(base_amount + gst),
        }

    @staticmethod
    def breakdown(db: Session, base) -> dict:
        """Breakdown at the currently configured rate."""
        return TaxService.for_base(base, TaxService.gst_percentage(db))
