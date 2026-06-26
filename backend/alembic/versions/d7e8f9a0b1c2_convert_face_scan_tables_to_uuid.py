"""convert face_scans / scan_results / scan_recommendations PKs to UUID

The full-schema UUID migration (f6e7d8c9b0a1) converted every Integer primary
key to UUID *except* the three face-scan tables, which it never touched. On the
production database that left ``face_scans.id`` (and the ``scan_results`` /
``scan_recommendations`` ``id`` + ``scan_id`` columns) typed as ``integer``
while the models declare ``GUID()``, so every upload failed with::

    psycopg2.errors.DatatypeMismatch: column "id" is of type integer
    but expression is of type uuid

Some environments were patched out-of-band and already have these columns as
``uuid``. This migration is therefore TYPE-AWARE and idempotent: it inspects the
live column types and only rewrites the ones still typed ``integer``, so it is a
no-op where the schema is already correct.

The integer -> uuid rewrite is DETERMINISTIC (``lpad(to_hex(n), 32, '0')::uuid``)
and applied identically to each primary key and the foreign keys that reference
it, so existing rows keep their relationships instead of being orphaned.

Revision ID: d7e8f9a0b1c2
Revises: e1a2b3c4d5e6
Create Date: 2026-06-26 06:30:00.000000

"""
from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'd7e8f9a0b1c2'
down_revision = 'e1a2b3c4d5e6'
branch_labels = None
depends_on = None


# (table, column) pairs to migrate; primary keys also get a uuid server default.
_COLUMNS = [
    ("face_scans", "id", True),
    ("scan_results", "id", True),
    ("scan_results", "scan_id", False),
    ("scan_recommendations", "id", True),
    ("scan_recommendations", "scan_id", False),
]

_INT_TO_UUID = "lpad(to_hex({col}), 32, '0')::uuid"


def _column_type(conn, table, column):
    row = conn.execute(
        text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).first()
    return row[0] if row else None


def upgrade():
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        # SQLite (test suite) builds these tables straight from the models via
        # ``create_all``, where GUID() maps to CHAR(32). Nothing to convert.
        return

    integer_cols = {
        (t, c)
        for (t, c, _pk) in _COLUMNS
        if _column_type(conn, t, c) == "integer"
    }
    if not integer_cols:
        # Already uuid everywhere — nothing to do.
        return

    # Foreign keys must be dropped before the referenced/parent columns change type.
    op.execute("ALTER TABLE scan_results DROP CONSTRAINT IF EXISTS scan_results_scan_id_fkey")
    op.execute("ALTER TABLE scan_recommendations DROP CONSTRAINT IF EXISTS scan_recommendations_scan_id_fkey")

    for table, column, is_pk in _COLUMNS:
        if (table, column) not in integer_cols:
            continue
        if is_pk:
            op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE uuid "
            f"USING {_INT_TO_UUID.format(col=column)}"
        )
        if is_pk:
            op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT gen_random_uuid()")

    # Recreate the foreign keys now that both sides are uuid.
    op.create_foreign_key(
        'scan_results_scan_id_fkey', 'scan_results', 'face_scans', ['scan_id'], ['id']
    )
    op.create_foreign_key(
        'scan_recommendations_scan_id_fkey', 'scan_recommendations', 'face_scans', ['scan_id'], ['id']
    )


def downgrade():
    raise Exception(
        "Downgrade not supported: converting UUID primary keys back to integer "
        "would lose the key values and break foreign references."
    )
