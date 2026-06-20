"""add user_description and doctor_description to appointments

Revision ID: e1f2a3b4c5d6
Revises: c7d8e9f0a1b2
Create Date: 2026-06-19 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('appointments', sa.Column('user_description', sa.Text(), nullable=True))
    op.add_column('appointments', sa.Column('doctor_description', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('appointments', 'doctor_description')
    op.drop_column('appointments', 'user_description')
