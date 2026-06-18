"""Bridge placeholder for the merged heads revision that was applied to the DB
but whose file was removed when the migration chain was restructured.

Revision ID: 82de73316d8d
Revises: 881ee87d7d95, a7b8c9d0e1f2
Create Date: 2026-06-17 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '82de73316d8d'
down_revision = ('881ee87d7d95', 'a7b8c9d0e1f2')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
