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
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = {c['name']: c for c in inspector.get_columns('doctor_leaves')}

    if 'reason' not in columns:
        op.add_column('doctor_leaves', sa.Column('reason', sa.String(length=255), nullable=True))
    if 'approved_by' not in columns:
        op.add_column('doctor_leaves', sa.Column('approved_by', GUID(), nullable=True))
    if 'approved_at' not in columns:
        op.add_column('doctor_leaves', sa.Column('approved_at', sa.DateTime(), nullable=True))
    if 'applied_at' not in columns:
        op.add_column('doctor_leaves', sa.Column('applied_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True))

    fks = inspector.get_foreign_keys('doctor_leaves')
    fk_exists = any(
        fk['referred_table'] == 'users' and fk['constrained_columns'] == ['approved_by']
        for fk in fks
    )
    if not fk_exists:
        op.create_foreign_key(None, 'doctor_leaves', 'users', ['approved_by'], ['id'])

    if 'doctor_reason' in columns:
        op.execute("UPDATE doctor_leaves SET reason = doctor_reason WHERE doctor_reason IS NOT NULL")


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = {c['name'] for c in inspector.get_columns('doctor_leaves')}

    if 'applied_at' in columns:
        op.drop_column('doctor_leaves', 'applied_at')
    if 'approved_at' in columns:
        op.drop_column('doctor_leaves', 'approved_at')
    if 'approved_by' in columns:
        op.drop_column('doctor_leaves', 'approved_by')
    if 'reason' in columns:
        op.drop_column('doctor_leaves', 'reason')
