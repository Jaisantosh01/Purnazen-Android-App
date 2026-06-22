"""create_doctor_leaves_table

Revision ID: 8f3d2fb1797e
Revises: 4f9873ef9e54
Create Date: 2026-06-21 11:16:29.228644

"""
from alembic import op
import sqlalchemy as sa
from app.db.types import GUID


revision = '8f3d2fb1797e'
down_revision = '4f9873ef9e54'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('doctor_leaves',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('doctor_id', GUID(), nullable=False),
        sa.Column('leave_date', sa.Date(), nullable=False),
        sa.Column('slot_timing_id', GUID(), nullable=True),
        sa.Column('doctor_reason', sa.String(length=255), nullable=True),
        sa.Column('admin_reason', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', GUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ),
        sa.ForeignKeyConstraint(['slot_timing_id'], ['slot_timings.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_doctor_leaves_doctor_id'), 'doctor_leaves', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_doctor_leaves_leave_date'), 'doctor_leaves', ['leave_date'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_doctor_leaves_leave_date'), table_name='doctor_leaves')
    op.drop_index(op.f('ix_doctor_leaves_doctor_id'), table_name='doctor_leaves')
    op.drop_table('doctor_leaves')
