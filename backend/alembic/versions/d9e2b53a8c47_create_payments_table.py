"""create payments table + appointments.payment_status

Revision ID: d9e2b53a8c47
Revises: c4d8a61f7b29
Create Date: 2026-06-12 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9e2b53a8c47'
down_revision = 'c4d8a61f7b29'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('payments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('appointment_id', sa.Integer(), nullable=True),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('currency', sa.String(length=10), nullable=False),
    sa.Column('provider', sa.String(length=30), nullable=False),
    sa.Column('order_id', sa.String(length=100), nullable=False),
    sa.Column('payment_id', sa.String(length=100), nullable=True),
    sa.Column('method', sa.String(length=20), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('order_id')
    )
    op.add_column(
        'appointments',
        sa.Column('payment_status', sa.String(length=20), nullable=False,
                  server_default='unpaid'),
    )


def downgrade():
    op.drop_column('appointments', 'payment_status')
    op.drop_table('payments')
