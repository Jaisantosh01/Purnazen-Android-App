"""create subscription_plans and user_subscriptions tables

Revision ID: ab12cd34ef56
Revises: d5e6f7a8b9c0
Create Date: 2026-07-24 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'ab12cd34ef56'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'subscription_plans',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('price', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(10), nullable=False, server_default='INR'),
        sa.Column('period', sa.String(20), nullable=False, server_default='month'),
        sa.Column('badge', sa.String(40), nullable=True),
        sa.Column('accent_color', sa.String(20), nullable=True),
        sa.Column('features', sa.JSON(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_subscription_plans_code'),
    )

    op.create_table(
        'user_subscriptions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('plan_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('started_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('current_period_end', sa.DateTime(), nullable=True),
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['plan_id'], ['subscription_plans.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_subscriptions_user_id', 'user_subscriptions', ['user_id'])


def downgrade():
    op.drop_index('ix_user_subscriptions_user_id', table_name='user_subscriptions')
    op.drop_table('user_subscriptions')
    op.drop_table('subscription_plans')
