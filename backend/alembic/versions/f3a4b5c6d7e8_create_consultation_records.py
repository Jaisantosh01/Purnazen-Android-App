"""create consultation_records table

Persists the doctor app's clinical records (doctor notes / diagnosis /
prescription) that were previously held only in an in-memory store.

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-06-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.db.types import GUID


revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'consultation_records',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('appointment_id', GUID(), nullable=False),
        sa.Column('doctor_id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('record_type', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', GUID(), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id']),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_consultation_records_appointment_id',
        'consultation_records',
        ['appointment_id'],
    )
    op.create_index(
        'ix_consultation_records_doctor_id',
        'consultation_records',
        ['doctor_id'],
    )
    op.create_index(
        'ix_consultation_records_user_id',
        'consultation_records',
        ['user_id'],
    )


def downgrade():
    op.drop_index('ix_consultation_records_user_id', table_name='consultation_records')
    op.drop_index('ix_consultation_records_doctor_id', table_name='consultation_records')
    op.drop_index('ix_consultation_records_appointment_id', table_name='consultation_records')
    op.drop_table('consultation_records')
