"""Import all models so Base.metadata is fully populated (used by Alembic, seed and tests)."""

from app.db.base_class import Base  # noqa: F401

from app.models.user import User  # noqa: E402,F401
from app.models.token_blocklist import TokenBlocklist  # noqa: E402,F401
from app.models.specialty import Specialty  # noqa: E402,F401
from app.models.language import Language  # noqa: E402,F401
from app.models.consultation_type import ConsultationType  # noqa: E402,F401
from app.models.expertise import Expertise  # noqa: E402,F401
from app.models.doctor import Doctor  # noqa: E402,F401
from app.models.clinic import Clinic  # noqa: E402,F401
from app.models.award import Award  # noqa: E402,F401
from app.models.doctor_availability import DoctorAvailability  # noqa: E402,F401
from app.models.quick_relief import QuickRelief  # noqa: E402,F401
from app.models.appointment import Appointment  # noqa: E402,F401
from app.models.therapy_session import TherapySession  # noqa: E402,F401
from app.models.wellness_session import WellnessSession  # noqa: E402,F401
from app.models.relief_session import ReliefSession  # noqa: E402,F401
from app.models.payment import Payment  # noqa: E402,F401
from app.models.associations import (  # noqa: E402,F401
    doctor_consultation_types,
    doctor_expertise,
    doctor_languages,
)
