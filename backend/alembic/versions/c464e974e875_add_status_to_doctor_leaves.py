"""add_status_to_doctor_leaves

Revision ID: c464e974e875
Revises: 8f3d2fb1797e
Create Date: 2026-06-21 11:19:50.342070

"""
from alembic import op
import sqlalchemy as sa


revision = 'c464e974e875'
down_revision = '8f3d2fb1797e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('doctor_leaves', sa.Column('status', sa.String(length=20), nullable=True, server_default='pending'))
    op.execute("UPDATE doctor_leaves SET status = 'pending' WHERE status IS NULL")
    op.alter_column('doctor_leaves', 'status', nullable=False)


def downgrade():
    op.drop_column('doctor_leaves', 'status')
