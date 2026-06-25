"""rename modified columns in therapy sessions

Revision ID: 158156a61c12
Revises: a784ffed457e
Create Date: 2026-06-17 16:01:48.195970

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '158156a61c12'
down_revision = 'a784ffed457e'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    ts_cols = {c['name'] for c in inspector.get_columns('therapy_sessions')}
    if 'modified_at' in ts_cols:
        op.alter_column("therapy_sessions", "modified_at", new_column_name="updated_at")
    if 'modified_by' in ts_cols:
        op.alter_column("therapy_sessions", "modified_by", new_column_name="updated_by")


def downgrade():
     op.alter_column(
        "therapy_sessions",
        "updated_at",
        new_column_name="modified_at"
    )

     op.alter_column(
        "therapy_sessions",
        "updated_by",
        new_column_name="modified_by"
    )
