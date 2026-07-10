"""create notification system tables

notifications (in-app feed), device_tokens (FCM push), notification_settings
(global admin switches) + appointments.reminder_sent_at (scheduler dedupe).

Revision ID: b1c2d3e4f5a6
Revises: a906a6d2233f
Create Date: 2026-07-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.db.types import GUID


revision = 'b1c2d3e4f5a6'
down_revision = 'a906a6d2233f'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'notifications',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('category', sa.String(20), nullable=False),
        sa.Column('event', sa.String(40), nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_user_read', 'notifications', ['user_id', 'is_read'])

    op.create_table(
        'device_tokens',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('token', sa.String(512), nullable=False),
        sa.Column('platform', sa.String(10), nullable=False, server_default='android'),
        sa.Column('app', sa.String(10), nullable=False, server_default='users'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index('ix_device_tokens_user_id', 'device_tokens', ['user_id'])

    op.create_table(
        'notification_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('appointments_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('payments_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('promos_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('reminders_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('reminder_lead_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.add_column('appointments', sa.Column('reminder_sent_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('appointments', 'reminder_sent_at')
    op.drop_table('notification_settings')
    op.drop_index('ix_device_tokens_user_id', table_name='device_tokens')
    op.drop_table('device_tokens')
    op.drop_index('ix_notifications_user_read', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')
