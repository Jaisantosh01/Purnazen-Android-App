"""unify heads after doctor-app-scaffold merge

Revision ID: 4f9873ef9e54
Revises: 82de73316d8d, e1f2a3b4c5d6
Create Date: 2026-06-20 11:56:30.947583

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4f9873ef9e54'
down_revision = ('82de73316d8d', 'e1f2a3b4c5d6')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
