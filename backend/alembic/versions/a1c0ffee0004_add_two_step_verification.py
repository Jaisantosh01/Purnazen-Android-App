"""two-step verification (TOTP) on users

Revision ID: a1c0ffee0004
Revises: a1c0ffee0003
Create Date: 2026-09-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1c0ffee0004'
down_revision = 'a1c0ffee0003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('users', sa.Column('mfa_secret', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('mfa_last_step', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('mfa_recovery_codes', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('users', 'mfa_recovery_codes')
    op.drop_column('users', 'mfa_last_step')
    op.drop_column('users', 'mfa_secret')
    op.drop_column('users', 'mfa_enabled')
