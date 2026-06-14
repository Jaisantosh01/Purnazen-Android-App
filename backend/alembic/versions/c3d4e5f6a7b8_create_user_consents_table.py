"""create user_consents table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-14 10:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_consents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('consent_type', sa.String(50), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('granted_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('consent_version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'consent_type', name='uq_user_consent_type'),
    )
    op.create_index('ix_user_consents_user_id', 'user_consents', ['user_id'])


def downgrade():
    op.drop_index('ix_user_consents_user_id', table_name='user_consents')
    op.drop_table('user_consents')
