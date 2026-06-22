"""add oauth fields to users

Revision ID: a1b2c3d4e5f6
Revises: e6f3a82d4c91
Create Date: 2026-06-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('oauth_provider', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('oauth_provider_id', sa.String(255), nullable=True))
    op.alter_column('users', 'password', nullable=True)
    op.create_index(
        'ix_users_oauth',
        'users',
        ['oauth_provider', 'oauth_provider_id'],
    )


def downgrade():
    op.drop_index('ix_users_oauth', table_name='users')
    op.alter_column('users', 'password', nullable=False)
    op.drop_column('users', 'oauth_provider_id')
    op.drop_column('users', 'oauth_provider')
