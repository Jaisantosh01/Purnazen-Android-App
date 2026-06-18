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
from app.models.user_preference import UserPreference  # noqa: E402,F401
from app.models.video_groups import VideoGroups  # noqa: E402,F401
from app.models.videos import Videos  # noqa: E402,F401
from app.models.video_group_mapping import VideoGroupMapping  # noqa: E402,F401
from app.models.chat_question import ChatQuestion  # noqa: E402,F401
from app.models.chat_option import ChatOption  # noqa: E402,F401
from app.models.role import Role  # noqa: E402,F401
from app.models.doctor_expertise_mapping import DoctorExpertiseMapping  # noqa: E402,F401
from app.models.doctor_language_mapping import DoctorLanguageMapping  # noqa: E402,F401
from app.models.doctor_speciality_mapping import DoctorSpecialityMapping  # noqa: E402,F401
from app.models.associations import (  # noqa: E402,F401
    doctor_consultation_types,
    doctor_expertise,
    doctor_languages,
)
