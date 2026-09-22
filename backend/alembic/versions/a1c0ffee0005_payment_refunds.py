"""refund columns on payments

Revision ID: a1c0ffee0005
Revises: a1c0ffee0004
Create Date: 2026-09-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1c0ffee0005'
down_revision = 'a1c0ffee0004'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('payments', sa.Column('refund_id', sa.String(length=100), nullable=True))
    op.add_column('payments', sa.Column('refunded_amount', sa.Numeric(10, 2), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('payments', 'refunded_amount')
    op.drop_column('payments', 'refund_id')
