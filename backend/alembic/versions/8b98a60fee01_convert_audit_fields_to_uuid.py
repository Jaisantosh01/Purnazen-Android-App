"""convert audit fields to uuid

Revision ID: 8b98a60fee01
Revises: 158156a61c12
Create Date: 2026-06-18 11:01:20.831105

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '8b98a60fee01'
down_revision = '158156a61c12'
branch_labels = None
depends_on = None


# Columns that should be converted from integer-based IDs to UUIDs.
uuid_columns = [
    # tables with standalone primary key IDs
    ('appointments', 'id'),
    ('awards', 'id'),
    ('chat_options', 'id'),
    ('chat_questions', 'id'),
    ('clinics', 'id'),
    ('consultation_types', 'id'),
    ('doctor_availability', 'id'),
    ('doctors', 'id'),
    ('expertise', 'id'),
    ('languages', 'id'),
    ('payments', 'id'),
    ('quick_reliefs', 'id'),
    ('relief_sessions', 'id'),
    ('specialties', 'id'),
    ('therapy_sessions', 'id'),
    ('token_blocklist', 'id'),
    ('user_preferences', 'id'),
    ('users', 'id'),
    ('video_group_mappings', 'id'),
    ('video_groups', 'id'),
    ('videos', 'id'),
    ('wellness_sessions', 'id'),

    # foreign key references
    ('appointments', 'user_id'),
    ('appointments', 'doctor_id'),
    ('appointments', 'consultation_type_id'),
    ('appointments', 'created_by'),
    ('appointments', 'updated_by'),
    ('awards', 'doctor_id'),
    ('awards', 'created_by'),
    ('awards', 'updated_by'),
    ('chat_options', 'question_id'),
    ('chat_options', 'next_question_id'),
    ('chat_options', 'video_group_id'),
    ('chat_options', 'created_by'),
    ('chat_options', 'updated_by'),
    ('chat_questions', 'created_by'),
    ('chat_questions', 'updated_by'),
    ('clinics', 'doctor_id'),
    ('clinics', 'created_by'),
    ('clinics', 'updated_by'),
    ('consultation_types', 'created_by'),
    ('consultation_types', 'updated_by'),
    ('doctor_availability', 'doctor_id'),
    ('doctor_availability', 'created_by'),
    ('doctor_availability', 'updated_by'),
    ('doctor_consultation_types', 'doctor_id'),
    ('doctor_consultation_types', 'consultation_type_id'),
    ('doctor_expertise', 'doctor_id'),
    ('doctor_expertise', 'expertise_id'),
    ('doctor_languages', 'doctor_id'),
    ('doctor_languages', 'language_id'),
    ('doctors', 'user_id'),
    ('doctors', 'specialty_id'),
    ('doctors', 'created_by'),
    ('doctors', 'updated_by'),
    ('expertise', 'created_by'),
    ('expertise', 'updated_by'),
    ('languages', 'created_by'),
    ('languages', 'updated_by'),
    ('payments', 'user_id'),
    ('payments', 'appointment_id'),
    ('payments', 'created_by'),
    ('payments', 'updated_by'),
    ('quick_reliefs', 'chat_question_id'),
    ('quick_reliefs', 'created_by'),
    ('quick_reliefs', 'updated_by'),
    ('relief_sessions', 'created_by'),
    ('relief_sessions', 'updated_by'),
    ('specialties', 'created_by'),
    ('specialties', 'updated_by'),
    ('therapy_sessions', 'user_id'),
    ('therapy_sessions', 'group_id'),
    ('therapy_sessions', 'video_id'),
    ('therapy_sessions', 'created_by'),
    ('therapy_sessions', 'updated_by'),
    ('user_preferences', 'user_id'),
    ('user_preferences', 'created_by'),
    ('user_preferences', 'updated_by'),
    ('video_group_mappings', 'video_group_id'),
    ('video_group_mappings', 'video_id'),
    ('video_group_mappings', 'created_by'),
    ('video_group_mappings', 'updated_by'),
    ('video_groups', 'created_by'),
    ('video_groups', 'updated_by'),
    ('videos', 'created_by'),
    ('videos', 'updated_by'),
    ('wellness_sessions', 'video_group_id'),
    ('wellness_sessions', 'created_by'),
    ('wellness_sessions', 'updated_by'),
]

existing_foreign_keys = [
    ('appointments', 'appointments_user_id_fkey'),
    ('appointments', 'appointments_doctor_id_fkey'),
    ('appointments', 'appointments_consultation_type_id_fkey'),
    ('awards', 'awards_doctor_id_fkey'),
    ('chat_options', 'chat_options_question_id_fkey'),
    ('chat_options', 'chat_options_next_question_id_fkey'),
    ('chat_options', 'chat_options_video_group_id_fkey'),
    ('chat_questions', 'chat_questions_created_by_fkey'),
    ('chat_questions', 'chat_questions_updated_by_fkey'),
    ('clinics', 'clinics_doctor_id_fkey'),
    ('doctor_availability', 'doctor_availability_doctor_id_fkey'),
    ('doctor_consultation_types', 'doctor_consultation_types_consultation_type_id_fkey'),
    ('doctor_consultation_types', 'doctor_consultation_types_doctor_id_fkey'),
    ('doctor_expertise', 'doctor_expertise_doctor_id_fkey'),
    ('doctor_expertise', 'doctor_expertise_expertise_id_fkey'),
    ('doctor_languages', 'doctor_languages_doctor_id_fkey'),
    ('doctor_languages', 'doctor_languages_language_id_fkey'),
    ('doctors', 'doctors_user_id_fkey'),
    ('doctors', 'doctors_specialty_id_fkey'),
    ('payments', 'payments_user_id_fkey'),
    ('payments', 'payments_appointment_id_fkey'),
    ('quick_reliefs', 'quick_reliefs_chat_question_id_fkey'),
    ('therapy_sessions', 'therapy_sessions_user_id_fkey'),
    ('therapy_sessions', 'therapy_sessions_group_id_fkey'),
    ('therapy_sessions', 'therapy_sessions_video_id_fkey'),
    ('therapy_sessions', 'therapy_sessions_created_by_fkey'),
    ('therapy_sessions', 'therapy_sessions_modified_by_fkey'),
    ('user_preferences', 'user_preferences_user_id_fkey'),
    ('video_group_mappings', 'video_group_mappings_video_group_id_fkey'),
    ('video_group_mappings', 'video_group_mappings_video_id_fkey'),
    ('video_group_mappings', 'video_group_mappings_created_by_fkey'),
    ('video_group_mappings', 'video_group_mappings_updated_by_fkey'),
    ('wellness_sessions', 'wellness_sessions_video_group_id_fkey'),
    ('wellness_sessions', 'wellness_sessions_created_by_fkey'),
    ('wellness_sessions', 'wellness_sessions_updated_by_fkey'),
    # audit constraints that may or may not already exist
    ('appointments', 'appointments_created_by_fkey'),
    ('appointments', 'appointments_updated_by_fkey'),
    ('awards', 'awards_created_by_fkey'),
    ('awards', 'awards_updated_by_fkey'),
    ('clinics', 'clinics_created_by_fkey'),
    ('clinics', 'clinics_updated_by_fkey'),
    ('consultation_types', 'consultation_types_created_by_fkey'),
    ('consultation_types', 'consultation_types_updated_by_fkey'),
    ('doctor_availability', 'doctor_availability_created_by_fkey'),
    ('doctor_availability', 'doctor_availability_updated_by_fkey'),
    ('doctors', 'doctors_created_by_fkey'),
    ('doctors', 'doctors_updated_by_fkey'),
    ('expertise', 'expertise_created_by_fkey'),
    ('expertise', 'expertise_updated_by_fkey'),
    ('languages', 'languages_created_by_fkey'),
    ('languages', 'languages_updated_by_fkey'),
    ('payments', 'payments_created_by_fkey'),
    ('payments', 'payments_updated_by_fkey'),
    ('quick_reliefs', 'quick_reliefs_created_by_fkey'),
    ('quick_reliefs', 'quick_reliefs_updated_by_fkey'),
    ('relief_sessions', 'relief_sessions_created_by_fkey'),
    ('relief_sessions', 'relief_sessions_updated_by_fkey'),
    ('specialties', 'specialties_created_by_fkey'),
    ('specialties', 'specialties_updated_by_fkey'),
    ('therapy_sessions', 'therapy_sessions_updated_by_fkey'),
    ('user_preferences', 'user_preferences_created_by_fkey'),
    ('user_preferences', 'user_preferences_updated_by_fkey'),
    ('video_groups', 'video_groups_created_by_fkey'),
    ('videos', 'videos_created_by_fkey'),
    ('videos', 'videos_updated_by_fkey'),
    ('users', 'users_created_by_fkey'),
    ('users', 'users_updated_by_fkey'),
]

new_foreign_keys = [
    ('appointments_user_id_fkey', 'appointments', 'users', ['user_id'], ['id']),
    ('appointments_doctor_id_fkey', 'appointments', 'doctors', ['doctor_id'], ['id']),
    ('appointments_consultation_type_id_fkey', 'appointments', 'consultation_types', ['consultation_type_id'], ['id']),
    ('appointments_created_by_fkey', 'appointments', 'users', ['created_by'], ['id']),
    ('appointments_updated_by_fkey', 'appointments', 'users', ['updated_by'], ['id']),
    ('awards_doctor_id_fkey', 'awards', 'doctors', ['doctor_id'], ['id']),
    ('awards_created_by_fkey', 'awards', 'users', ['created_by'], ['id']),
    ('awards_updated_by_fkey', 'awards', 'users', ['updated_by'], ['id']),
    ('chat_options_question_id_fkey', 'chat_options', 'chat_questions', ['question_id'], ['id']),
    ('chat_options_next_question_id_fkey', 'chat_options', 'chat_questions', ['next_question_id'], ['id']),
    ('chat_options_video_group_id_fkey', 'chat_options', 'video_groups', ['video_group_id'], ['id']),
    ('chat_options_created_by_fkey', 'chat_options', 'users', ['created_by'], ['id']),
    ('chat_options_updated_by_fkey', 'chat_options', 'users', ['updated_by'], ['id']),
    ('chat_questions_created_by_fkey', 'chat_questions', 'users', ['created_by'], ['id']),
    ('chat_questions_updated_by_fkey', 'chat_questions', 'users', ['updated_by'], ['id']),
    ('clinics_doctor_id_fkey', 'clinics', 'doctors', ['doctor_id'], ['id']),
    ('clinics_created_by_fkey', 'clinics', 'users', ['created_by'], ['id']),
    ('clinics_updated_by_fkey', 'clinics', 'users', ['updated_by'], ['id']),
    ('consultation_types_created_by_fkey', 'consultation_types', 'users', ['created_by'], ['id']),
    ('consultation_types_updated_by_fkey', 'consultation_types', 'users', ['updated_by'], ['id']),
    ('doctor_availability_doctor_id_fkey', 'doctor_availability', 'doctors', ['doctor_id'], ['id']),
    ('doctor_availability_created_by_fkey', 'doctor_availability', 'users', ['created_by'], ['id']),
    ('doctor_availability_updated_by_fkey', 'doctor_availability', 'users', ['updated_by'], ['id']),
    ('doctor_consultation_types_consultation_type_id_fkey', 'doctor_consultation_types', 'consultation_types', ['consultation_type_id'], ['id']),
    ('doctor_consultation_types_doctor_id_fkey', 'doctor_consultation_types', 'doctors', ['doctor_id'], ['id']),
    ('doctor_expertise_doctor_id_fkey', 'doctor_expertise', 'doctors', ['doctor_id'], ['id']),
    ('doctor_expertise_expertise_id_fkey', 'doctor_expertise', 'expertise', ['expertise_id'], ['id']),
    ('doctor_languages_doctor_id_fkey', 'doctor_languages', 'doctors', ['doctor_id'], ['id']),
    ('doctor_languages_language_id_fkey', 'doctor_languages', 'languages', ['language_id'], ['id']),
    ('doctors_user_id_fkey', 'doctors', 'users', ['user_id'], ['id']),
    ('doctors_specialty_id_fkey', 'doctors', 'specialties', ['specialty_id'], ['id']),
    ('doctors_created_by_fkey', 'doctors', 'users', ['created_by'], ['id']),
    ('doctors_updated_by_fkey', 'doctors', 'users', ['updated_by'], ['id']),
    ('expertise_created_by_fkey', 'expertise', 'users', ['created_by'], ['id']),
    ('expertise_updated_by_fkey', 'expertise', 'users', ['updated_by'], ['id']),
    ('languages_created_by_fkey', 'languages', 'users', ['created_by'], ['id']),
    ('languages_updated_by_fkey', 'languages', 'users', ['updated_by'], ['id']),
    ('payments_user_id_fkey', 'payments', 'users', ['user_id'], ['id']),
    ('payments_appointment_id_fkey', 'payments', 'appointments', ['appointment_id'], ['id']),
    ('payments_created_by_fkey', 'payments', 'users', ['created_by'], ['id']),
    ('payments_updated_by_fkey', 'payments', 'users', ['updated_by'], ['id']),
    ('quick_reliefs_chat_question_id_fkey', 'quick_reliefs', 'chat_questions', ['chat_question_id'], ['id']),
    ('quick_reliefs_created_by_fkey', 'quick_reliefs', 'users', ['created_by'], ['id']),
    ('quick_reliefs_updated_by_fkey', 'quick_reliefs', 'users', ['updated_by'], ['id']),
    ('relief_sessions_created_by_fkey', 'relief_sessions', 'users', ['created_by'], ['id']),
    ('relief_sessions_updated_by_fkey', 'relief_sessions', 'users', ['updated_by'], ['id']),
    ('specialties_created_by_fkey', 'specialties', 'users', ['created_by'], ['id']),
    ('specialties_updated_by_fkey', 'specialties', 'users', ['updated_by'], ['id']),
    ('therapy_sessions_user_id_fkey', 'therapy_sessions', 'users', ['user_id'], ['id']),
    ('therapy_sessions_group_id_fkey', 'therapy_sessions', 'video_groups', ['group_id'], ['id']),
    ('therapy_sessions_video_id_fkey', 'therapy_sessions', 'videos', ['video_id'], ['id']),
    ('therapy_sessions_created_by_fkey', 'therapy_sessions', 'users', ['created_by'], ['id']),
    ('therapy_sessions_updated_by_fkey', 'therapy_sessions', 'users', ['updated_by'], ['id']),
    ('user_preferences_user_id_fkey', 'user_preferences', 'users', ['user_id'], ['id']),
    ('user_preferences_created_by_fkey', 'user_preferences', 'users', ['created_by'], ['id']),
    ('user_preferences_updated_by_fkey', 'user_preferences', 'users', ['updated_by'], ['id']),
    ('video_group_mappings_video_group_id_fkey', 'video_group_mappings', 'video_groups', ['video_group_id'], ['id']),
    ('video_group_mappings_video_id_fkey', 'video_group_mappings', 'videos', ['video_id'], ['id']),
    ('video_group_mappings_created_by_fkey', 'video_group_mappings', 'users', ['created_by'], ['id']),
    ('video_group_mappings_updated_by_fkey', 'video_group_mappings', 'users', ['updated_by'], ['id']),
    ('video_groups_created_by_fkey', 'video_groups', 'users', ['created_by'], ['id']),
    ('video_groups_updated_by_fkey', 'video_groups', 'users', ['updated_by'], ['id']),
    ('videos_created_by_fkey', 'videos', 'users', ['created_by'], ['id']),
    ('videos_updated_by_fkey', 'videos', 'users', ['updated_by'], ['id']),
    ('wellness_sessions_video_group_id_fkey', 'wellness_sessions', 'video_groups', ['video_group_id'], ['id']),
    ('wellness_sessions_created_by_fkey', 'wellness_sessions', 'users', ['created_by'], ['id']),
    ('wellness_sessions_updated_by_fkey', 'wellness_sessions', 'users', ['updated_by'], ['id']),
    ('users_created_by_fkey', 'users', 'users', ['created_by'], ['id']),
    ('users_updated_by_fkey', 'users', 'users', ['updated_by'], ['id']),
]


def upgrade():
    # Drop existing foreign keys first so we can convert integer IDs to UUIDs cleanly.
    for table, constraint_name in existing_foreign_keys:
        op.execute(
            f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{constraint_name}"'
        )

    for table, column in uuid_columns:
        using = f'md5("{column}"::text)::uuid'
        op.execute(
            f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE uuid USING ({using})'
        )
        if column == 'id':
            op.execute(
                f'ALTER TABLE "{table}" ALTER COLUMN "{column}" SET DEFAULT gen_random_uuid()'
            )

    # Recreate foreign keys on the converted UUID columns.
    for constraint_name, source_table, referent_table, local_cols, remote_cols in new_foreign_keys:
        op.create_foreign_key(
            constraint_name,
            source_table,
            referent_table,
            local_cols,
            remote_cols,
        )


def downgrade():
    for constraint_name, source_table, referent_table, local_cols, remote_cols in reversed(new_foreign_keys):
        op.drop_constraint(constraint_name, source_table, type_='foreignkey')

    for table, column in reversed(uuid_columns):
        using = f'text2ltree(\"{column}\"::text)' if False else f'md5("{column}"::text)::uuid'
        if column == 'id':
            op.execute(
                f'ALTER TABLE "{table}" ALTER COLUMN "{column}" DROP DEFAULT'
            )
        op.execute(
            f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE integer USING (NULLIF("{column}"::text, '')::integer)'
        )

    for table, constraint_name in existing_foreign_keys:
        op.execute(
            f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{constraint_name}"'
        )
