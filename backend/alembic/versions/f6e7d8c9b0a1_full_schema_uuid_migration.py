"""Full schema UUID migration: convert all Integer PKs to UUID

Revision ID: f6e7d8c9b0a1
Revises: a363ff2f13d5
Create Date: 2026-06-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f6e7d8c9b0a1'
down_revision = 'a363ff2f13d5'
branch_labels = None
depends_on = None


def upgrade():
    # ---------------------------------------------------------------
    # 1. DROP ALL EXISTING FOREIGN KEY CONSTRAINTS
    # ---------------------------------------------------------------
    op.drop_constraint('appointments_consultation_type_id_fkey', 'appointments', type_='foreignkey')
    op.drop_constraint('appointments_doctor_id_fkey', 'appointments', type_='foreignkey')
    op.drop_constraint('appointments_slot_timing_id_fkey', 'appointments', type_='foreignkey')
    op.drop_constraint('appointments_user_id_fkey', 'appointments', type_='foreignkey')
    op.drop_constraint('awards_doctor_id_fkey', 'awards', type_='foreignkey')
    op.drop_constraint('chat_options_next_question_id_fkey', 'chat_options', type_='foreignkey')
    op.drop_constraint('chat_options_question_id_fkey', 'chat_options', type_='foreignkey')
    op.drop_constraint('chat_options_video_group_id_fkey', 'chat_options', type_='foreignkey')
    op.drop_constraint('chat_questions_created_by_fkey', 'chat_questions', type_='foreignkey')
    op.drop_constraint('chat_questions_updated_by_fkey', 'chat_questions', type_='foreignkey')
    op.drop_constraint('clinics_doctor_id_fkey', 'clinics', type_='foreignkey')
    op.drop_constraint('consultation_types_created_by_fkey', 'consultation_types', type_='foreignkey')
    op.drop_constraint('consultation_types_updated_by_fkey', 'consultation_types', type_='foreignkey')
    op.drop_constraint('doctor_availability_doctor_id_fkey', 'doctor_availability', type_='foreignkey')
    op.drop_constraint('doctor_availability_slot_timing_id_fkey', 'doctor_availability', type_='foreignkey')
    op.drop_constraint('doctor_consultation_types_consultation_type_id_fkey', 'doctor_consultation_types', type_='foreignkey')
    op.drop_constraint('doctor_consultation_types_doctor_id_fkey', 'doctor_consultation_types', type_='foreignkey')
    op.drop_constraint('doctor_expertise_doctor_id_fkey', 'doctor_expertise', type_='foreignkey')
    op.drop_constraint('doctor_expertise_expertise_id_fkey', 'doctor_expertise', type_='foreignkey')
    op.drop_constraint('doctor_expertise_mapping_created_by_fkey', 'doctor_expertise_mapping', type_='foreignkey')
    op.drop_constraint('doctor_expertise_mapping_doctor_id_fkey', 'doctor_expertise_mapping', type_='foreignkey')
    op.drop_constraint('doctor_expertise_mapping_expertise_id_fkey', 'doctor_expertise_mapping', type_='foreignkey')
    op.drop_constraint('doctor_expertise_mapping_updated_by_fkey', 'doctor_expertise_mapping', type_='foreignkey')
    op.drop_constraint('doctor_language_mapping_created_by_fkey', 'doctor_language_mapping', type_='foreignkey')
    op.drop_constraint('doctor_language_mapping_doctor_id_fkey', 'doctor_language_mapping', type_='foreignkey')
    op.drop_constraint('doctor_language_mapping_language_id_fkey', 'doctor_language_mapping', type_='foreignkey')
    op.drop_constraint('doctor_language_mapping_updated_by_fkey', 'doctor_language_mapping', type_='foreignkey')
    op.drop_constraint('doctor_languages_doctor_id_fkey', 'doctor_languages', type_='foreignkey')
    op.drop_constraint('doctor_languages_language_id_fkey', 'doctor_languages', type_='foreignkey')
    op.drop_constraint('doctor_speciality_mapping_created_by_fkey', 'doctor_speciality_mapping', type_='foreignkey')
    op.drop_constraint('doctor_speciality_mapping_doctor_id_fkey', 'doctor_speciality_mapping', type_='foreignkey')
    op.drop_constraint('doctor_speciality_mapping_speciality_id_fkey', 'doctor_speciality_mapping', type_='foreignkey')
    op.drop_constraint('doctor_speciality_mapping_updated_by_fkey', 'doctor_speciality_mapping', type_='foreignkey')
    op.drop_constraint('doctors_specialty_id_fkey', 'doctors', type_='foreignkey')
    op.drop_constraint('doctors_user_id_fkey', 'doctors', type_='foreignkey')
    op.drop_constraint('payments_appointment_id_fkey', 'payments', type_='foreignkey')
    op.drop_constraint('payments_user_id_fkey', 'payments', type_='foreignkey')
    op.drop_constraint('quick_reliefs_chat_question_id_fkey', 'quick_reliefs', type_='foreignkey')
    op.drop_constraint('roles_created_by_fkey', 'roles', type_='foreignkey')
    op.drop_constraint('roles_updated_by_fkey', 'roles', type_='foreignkey')
    op.drop_constraint('slot_timings_created_by_fkey', 'slot_timings', type_='foreignkey')
    op.drop_constraint('slot_timings_day_of_week_id_fkey', 'slot_timings', type_='foreignkey')
    op.drop_constraint('slot_timings_updated_by_fkey', 'slot_timings', type_='foreignkey')
    op.drop_constraint('therapy_sessions_created_by_fkey', 'therapy_sessions', type_='foreignkey')
    op.drop_constraint('therapy_sessions_group_id_fkey', 'therapy_sessions', type_='foreignkey')
    op.drop_constraint('therapy_sessions_updated_by_fkey', 'therapy_sessions', type_='foreignkey')
    op.drop_constraint('therapy_sessions_user_id_fkey', 'therapy_sessions', type_='foreignkey')
    op.drop_constraint('therapy_sessions_video_id_fkey', 'therapy_sessions', type_='foreignkey')
    op.drop_constraint('user_preferences_user_id_fkey', 'user_preferences', type_='foreignkey')
    op.drop_constraint('users_role_id_fkey', 'users', type_='foreignkey')
    op.drop_constraint('video_group_mappings_created_by_fkey', 'video_group_mappings', type_='foreignkey')
    op.drop_constraint('video_group_mappings_updated_by_fkey', 'video_group_mappings', type_='foreignkey')
    op.drop_constraint('video_group_mappings_video_group_id_fkey', 'video_group_mappings', type_='foreignkey')
    op.drop_constraint('video_group_mappings_video_id_fkey', 'video_group_mappings', type_='foreignkey')
    op.drop_constraint('wellness_sessions_created_by_fkey', 'wellness_sessions', type_='foreignkey')
    op.drop_constraint('wellness_sessions_updated_by_fkey', 'wellness_sessions', type_='foreignkey')
    op.drop_constraint('wellness_sessions_video_group_id_fkey', 'wellness_sessions', type_='foreignkey')

    op.drop_index('ix_appointments_doctor_date', table_name='appointments')
    op.drop_index('ix_therapy_sessions_user_group_video', table_name='therapy_sessions')

    # ---------------------------------------------------------------
    # 2. DROP ALL TABLES
    # ---------------------------------------------------------------
    op.drop_table('doctor_languages')
    op.drop_table('doctor_expertise')
    op.drop_table('doctor_consultation_types')
    op.drop_table('relief_sessions')
    op.drop_table('wellness_sessions')
    op.drop_table('therapy_sessions')
    op.drop_table('quick_reliefs')
    op.drop_table('chat_options')
    op.drop_table('video_group_mappings')
    op.drop_table('chat_questions')
    op.drop_table('video_groups')
    op.drop_table('videos')
    op.drop_table('payments')
    op.drop_table('appointments')
    op.drop_table('doctor_speciality_mapping')
    op.drop_table('doctor_language_mapping')
    op.drop_table('doctor_expertise_mapping')
    op.drop_table('clinics')
    op.drop_table('awards')
    op.drop_table('doctor_availability')
    op.drop_table('slot_timings')
    op.drop_table('doctors')
    op.drop_table('user_preferences')
    op.drop_table('days_of_week')
    op.drop_table('users')
    op.drop_table('roles')
    op.drop_table('specialties')
    op.drop_table('expertise')
    op.drop_table('languages')
    op.drop_table('consultation_types')
    op.drop_table('token_blocklist')

    # ---------------------------------------------------------------
    # 3. CREATE ALL TABLES WITH UUID PRIMARY KEYS
    # ---------------------------------------------------------------

    op.create_table('token_blocklist',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('jti', sa.String(255), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table('days_of_week',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('day_number', sa.Integer(), nullable=False, unique=True),
        sa.Column('day', sa.String(20), nullable=False, unique=True),
    )

    op.create_table('consultation_types',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('specialties',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('expertise',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('languages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('email', sa.String(120), nullable=False, unique=True),
        sa.Column('password', sa.String(255), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('token_version', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('user_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('push_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('notifications', postgresql.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('doctors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('specialty_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('about', sa.Text(), nullable=True),
        sa.Column('education', sa.Text(), nullable=True),
        sa.Column('experience_years', sa.Integer(), nullable=False),
        sa.Column('consultation_fee', sa.Numeric(10, 2), nullable=False),
        sa.Column('average_rating', sa.Numeric(3, 2), server_default=sa.text('0')),
        sa.Column('reviews_count', sa.Integer(), server_default=sa.text('0')),
        sa.Column('is_available_today', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('slot_timings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('day_of_week_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('doctor_availability',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('slot_timing_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('awards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('issuer', sa.String(255), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('clinics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('doctor_expertise_mapping',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('expertise_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('doctor_language_mapping',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('language_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('doctor_speciality_mapping',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('speciality_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('appointments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('consultation_type_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('visit_type', sa.String(20), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('slot_timing_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'booked'")),
        sa.Column('payment_status', sa.String(20), nullable=False, server_default=sa.text("'unpaid'")),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('appointment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False, server_default=sa.text("'INR'")),
        sa.Column('provider', sa.String(30), nullable=False, server_default=sa.text("'razorpay'")),
        sa.Column('order_id', sa.String(100), nullable=False, unique=True),
        sa.Column('payment_id', sa.String(100), nullable=True),
        sa.Column('method', sa.String(20), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'created'")),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('chat_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('question_text', sa.String(500), nullable=False),
        sa.Column('is_start', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
    )

    op.create_table('video_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('icon', sa.String(20), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=False),
    )

    op.create_table('videos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('icon', sa.String(20), nullable=True),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=False),
    )

    op.create_table('video_group_mappings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('video_group_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('video_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=False),
    )

    op.create_table('chat_options',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('option_text', sa.String(255), nullable=False),
        sa.Column('next_question_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('video_group_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('quick_reliefs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('subtitle', sa.String(255), nullable=True),
        sa.Column('chat_question_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('icon_name', sa.String(100), nullable=True),
        sa.Column('icon_url', sa.String(500), nullable=True),
        sa.Column('background_color', sa.String(20), nullable=True),
        sa.Column('text_color', sa.String(20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('therapy_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('video_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_type', sa.String(30), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'Completed'")),
        sa.Column('pain_before', sa.Integer(), nullable=True),
        sa.Column('pain_after', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=False),
    )

    op.create_table('wellness_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('duration', sa.String(30), nullable=False),
        sa.Column('icon', sa.String(20), nullable=True),
        sa.Column('video_group_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=False),
    )

    op.create_table('relief_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('key', sa.String(100), nullable=False, unique=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('duration', sa.String(30), nullable=False),
        sa.Column('icon', sa.String(20), nullable=True),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('total_cycles', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('steps', postgresql.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_table('doctor_languages',
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('language_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint('doctor_id', 'language_id'),
    )

    op.create_table('doctor_expertise',
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('expertise_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint('doctor_id', 'expertise_id'),
    )

    op.create_table('doctor_consultation_types',
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('consultation_type_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint('doctor_id', 'consultation_type_id'),
    )

    # ---------------------------------------------------------------
    # 4. RECREATE INDEXES
    # ---------------------------------------------------------------
    op.create_index('ix_appointments_doctor_date', 'appointments', ['doctor_id', 'date'])
    op.create_index('ix_therapy_sessions_user_group_video', 'therapy_sessions', ['user_id', 'group_id', 'video_id'])

    # ---------------------------------------------------------------
    # 5. RECREATE ALL FOREIGN KEY CONSTRAINTS
    # ---------------------------------------------------------------
    op.create_foreign_key('users_role_id_fkey', 'users', 'roles', ['role_id'], ['id'])
    op.create_foreign_key('user_preferences_user_id_fkey', 'user_preferences', 'users', ['user_id'], ['id'])
    op.create_foreign_key('consultation_types_created_by_fkey', 'consultation_types', 'users', ['created_by'], ['id'])
    op.create_foreign_key('consultation_types_updated_by_fkey', 'consultation_types', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('doctors_user_id_fkey', 'doctors', 'users', ['user_id'], ['id'])
    op.create_foreign_key('doctors_specialty_id_fkey', 'doctors', 'specialties', ['specialty_id'], ['id'])
    op.create_foreign_key('slot_timings_day_of_week_id_fkey', 'slot_timings', 'days_of_week', ['day_of_week_id'], ['id'])
    op.create_foreign_key('doctor_availability_doctor_id_fkey', 'doctor_availability', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_availability_slot_timing_id_fkey', 'doctor_availability', 'slot_timings', ['slot_timing_id'], ['id'])
    op.create_foreign_key('awards_doctor_id_fkey', 'awards', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('clinics_doctor_id_fkey', 'clinics', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_expertise_mapping_doctor_id_fkey', 'doctor_expertise_mapping', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_expertise_mapping_expertise_id_fkey', 'doctor_expertise_mapping', 'expertise', ['expertise_id'], ['id'])
    op.create_foreign_key('doctor_language_mapping_doctor_id_fkey', 'doctor_language_mapping', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_language_mapping_language_id_fkey', 'doctor_language_mapping', 'languages', ['language_id'], ['id'])
    op.create_foreign_key('doctor_speciality_mapping_doctor_id_fkey', 'doctor_speciality_mapping', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_speciality_mapping_speciality_id_fkey', 'doctor_speciality_mapping', 'specialties', ['speciality_id'], ['id'])
    op.create_foreign_key('appointments_user_id_fkey', 'appointments', 'users', ['user_id'], ['id'])
    op.create_foreign_key('appointments_doctor_id_fkey', 'appointments', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('appointments_consultation_type_id_fkey', 'appointments', 'consultation_types', ['consultation_type_id'], ['id'])
    op.create_foreign_key('appointments_slot_timing_id_fkey', 'appointments', 'slot_timings', ['slot_timing_id'], ['id'])
    op.create_foreign_key('payments_user_id_fkey', 'payments', 'users', ['user_id'], ['id'])
    op.create_foreign_key('payments_appointment_id_fkey', 'payments', 'appointments', ['appointment_id'], ['id'])
    op.create_foreign_key('chat_questions_created_by_fkey', 'chat_questions', 'users', ['created_by'], ['id'])
    op.create_foreign_key('chat_questions_updated_by_fkey', 'chat_questions', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('chat_options_question_id_fkey', 'chat_options', 'chat_questions', ['question_id'], ['id'])
    op.create_foreign_key('chat_options_next_question_id_fkey', 'chat_options', 'chat_questions', ['next_question_id'], ['id'])
    op.create_foreign_key('chat_options_video_group_id_fkey', 'chat_options', 'video_groups', ['video_group_id'], ['id'])
    op.create_foreign_key('quick_reliefs_chat_question_id_fkey', 'quick_reliefs', 'chat_questions', ['chat_question_id'], ['id'])
    op.create_foreign_key('video_groups_created_by_fkey', 'video_groups', 'users', ['created_by'], ['id'])
    op.create_foreign_key('video_groups_updated_by_fkey', 'video_groups', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('videos_created_by_fkey', 'videos', 'users', ['created_by'], ['id'])
    op.create_foreign_key('videos_updated_by_fkey', 'videos', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('video_group_mappings_video_group_id_fkey', 'video_group_mappings', 'video_groups', ['video_group_id'], ['id'])
    op.create_foreign_key('video_group_mappings_video_id_fkey', 'video_group_mappings', 'videos', ['video_id'], ['id'])
    op.create_foreign_key('video_group_mappings_created_by_fkey', 'video_group_mappings', 'users', ['created_by'], ['id'])
    op.create_foreign_key('video_group_mappings_updated_by_fkey', 'video_group_mappings', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('therapy_sessions_user_id_fkey', 'therapy_sessions', 'users', ['user_id'], ['id'])
    op.create_foreign_key('therapy_sessions_group_id_fkey', 'therapy_sessions', 'video_groups', ['group_id'], ['id'])
    op.create_foreign_key('therapy_sessions_video_id_fkey', 'therapy_sessions', 'videos', ['video_id'], ['id'])
    op.create_foreign_key('therapy_sessions_created_by_fkey', 'therapy_sessions', 'users', ['created_by'], ['id'])
    op.create_foreign_key('therapy_sessions_updated_by_fkey', 'therapy_sessions', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('wellness_sessions_video_group_id_fkey', 'wellness_sessions', 'video_groups', ['video_group_id'], ['id'])
    op.create_foreign_key('wellness_sessions_created_by_fkey', 'wellness_sessions', 'users', ['created_by'], ['id'])
    op.create_foreign_key('wellness_sessions_updated_by_fkey', 'wellness_sessions', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('roles_created_by_fkey', 'roles', 'users', ['created_by'], ['id'])
    op.create_foreign_key('roles_updated_by_fkey', 'roles', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('slot_timings_created_by_fkey', 'slot_timings', 'users', ['created_by'], ['id'])
    op.create_foreign_key('slot_timings_updated_by_fkey', 'slot_timings', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('doctor_availability_created_by_fkey', 'doctor_availability', 'users', ['created_by'], ['id'])
    op.create_foreign_key('doctor_availability_updated_by_fkey', 'doctor_availability', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('awards_created_by_fkey', 'awards', 'users', ['created_by'], ['id'])
    op.create_foreign_key('awards_updated_by_fkey', 'awards', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('clinics_created_by_fkey', 'clinics', 'users', ['created_by'], ['id'])
    op.create_foreign_key('clinics_updated_by_fkey', 'clinics', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('doctor_expertise_mapping_created_by_fkey', 'doctor_expertise_mapping', 'users', ['created_by'], ['id'])
    op.create_foreign_key('doctor_expertise_mapping_updated_by_fkey', 'doctor_expertise_mapping', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('doctor_language_mapping_created_by_fkey', 'doctor_language_mapping', 'users', ['created_by'], ['id'])
    op.create_foreign_key('doctor_language_mapping_updated_by_fkey', 'doctor_language_mapping', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('doctor_speciality_mapping_created_by_fkey', 'doctor_speciality_mapping', 'users', ['created_by'], ['id'])
    op.create_foreign_key('doctor_speciality_mapping_updated_by_fkey', 'doctor_speciality_mapping', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('appointments_created_by_fkey', 'appointments', 'users', ['created_by'], ['id'])
    op.create_foreign_key('appointments_updated_by_fkey', 'appointments', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('payments_created_by_fkey', 'payments', 'users', ['created_by'], ['id'])
    op.create_foreign_key('payments_updated_by_fkey', 'payments', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('users_created_by_fkey', 'users', 'users', ['created_by'], ['id'])
    op.create_foreign_key('users_updated_by_fkey', 'users', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('user_preferences_created_by_fkey', 'user_preferences', 'users', ['created_by'], ['id'])
    op.create_foreign_key('user_preferences_updated_by_fkey', 'user_preferences', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('chat_options_created_by_fkey', 'chat_options', 'users', ['created_by'], ['id'])
    op.create_foreign_key('chat_options_updated_by_fkey', 'chat_options', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('quick_reliefs_created_by_fkey', 'quick_reliefs', 'users', ['created_by'], ['id'])
    op.create_foreign_key('quick_reliefs_updated_by_fkey', 'quick_reliefs', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('relief_sessions_created_by_fkey', 'relief_sessions', 'users', ['created_by'], ['id'])
    op.create_foreign_key('relief_sessions_updated_by_fkey', 'relief_sessions', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('specialties_created_by_fkey', 'specialties', 'users', ['created_by'], ['id'])
    op.create_foreign_key('specialties_updated_by_fkey', 'specialties', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('expertise_created_by_fkey', 'expertise', 'users', ['created_by'], ['id'])
    op.create_foreign_key('expertise_updated_by_fkey', 'expertise', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('languages_created_by_fkey', 'languages', 'users', ['created_by'], ['id'])
    op.create_foreign_key('languages_updated_by_fkey', 'languages', 'users', ['updated_by'], ['id'])
    op.create_foreign_key('doctor_languages_doctor_id_fkey', 'doctor_languages', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_languages_language_id_fkey', 'doctor_languages', 'languages', ['language_id'], ['id'])
    op.create_foreign_key('doctor_expertise_doctor_id_fkey', 'doctor_expertise', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_expertise_expertise_id_fkey', 'doctor_expertise', 'expertise', ['expertise_id'], ['id'])
    op.create_foreign_key('doctor_consultation_types_doctor_id_fkey', 'doctor_consultation_types', 'doctors', ['doctor_id'], ['id'])
    op.create_foreign_key('doctor_consultation_types_consultation_type_id_fkey', 'doctor_consultation_types', 'consultation_types', ['consultation_type_id'], ['id'])
    op.create_foreign_key('doctors_created_by_fkey', 'doctors', 'users', ['created_by'], ['id'])
    op.create_foreign_key('doctors_updated_by_fkey', 'doctors', 'users', ['updated_by'], ['id'])


def downgrade():
    raise Exception("Downgrade not supported - data loss would occur. See the migration source for the downgrade path if needed.")
