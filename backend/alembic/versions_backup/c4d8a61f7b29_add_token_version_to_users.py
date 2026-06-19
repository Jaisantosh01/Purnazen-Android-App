"""add token_version to users (revoke tokens on password change)

Revision ID: c4d8a61f7b29
Revises: b7c1f4e92d35
Create Date: 2026-06-12 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4d8a61f7b29'
down_revision = 'b7c1f4e92d35'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade():
    op.drop_column('users', 'token_version')
