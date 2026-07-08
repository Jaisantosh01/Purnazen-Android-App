"""fix_doctor_leaves_columns

Revision ID: a906a6d2233f
Revises: 1d4fdef30b40
Create Date: 2026-07-06 17:24:56.555046

"""
from alembic import op
import sqlalchemy as sa
from app.db.types import GUID


# revision identifiers, used by Alembic.
revision = 'a906a6d2233f'
down_revision = '1d4fdef30b40'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('doctor_leaves', sa.Column('reason', sa.String(length=255), nullable=True))
    op.add_column('doctor_leaves', sa.Column('approved_by', GUID(), nullable=True))
    op.add_column('doctor_leaves', sa.Column('approved_at', sa.DateTime(), nullable=True))
    op.add_column('doctor_leaves', sa.Column('applied_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True))
    op.create_foreign_key(None, 'doctor_leaves', 'users', ['approved_by'], ['id'])
    op.execute("UPDATE doctor_leaves SET reason = doctor_reason WHERE doctor_reason IS NOT NULL")


def downgrade():
    op.drop_column('doctor_leaves', 'reason')
    op.drop_column('doctor_leaves', 'approved_by')
    op.drop_column('doctor_leaves', 'approved_at')
    op.drop_column('doctor_leaves', 'applied_at')
