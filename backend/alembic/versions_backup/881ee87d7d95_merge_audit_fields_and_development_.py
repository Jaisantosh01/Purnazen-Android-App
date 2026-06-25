"""merge audit fields and development migrations

Revision ID: 881ee87d7d95
Revises: b3bec455c884, 856c85ff7105
Create Date: 2026-06-17 15:25:05.432619

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '881ee87d7d95'
down_revision = ('b3bec455c884', '856c85ff7105')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
