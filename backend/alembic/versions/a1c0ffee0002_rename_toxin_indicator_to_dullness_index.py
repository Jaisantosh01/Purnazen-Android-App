"""rename scan_results.toxin_indicator to dullness_index

The metric is computed from luminance uniformity, saturation falloff and
periorbital darkness — appearance measurements from a photograph. Its old name
asserted a physiological state of the user's body, which is a health claim this
app is in no position to make and which Play's health-content policy does not
permit from a non-medical-device app. The column is renamed, not recomputed:
the values are unchanged.

The API field renames with it (`toxinIndicator` -> `dullnessIndex`) with no
compatibility alias, deliberately — nothing is published to a store yet, so
there is no installed build to keep reading the old key, and leaving the old
name in the response would defeat the point of the rename.

Revision ID: a1c0ffee0002
Revises: a1c0ffee0001
Create Date: 2026-09-12 00:00:00.000000

"""
from alembic import op


revision = 'a1c0ffee0002'
down_revision = 'a1c0ffee0001'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('scan_results', 'toxin_indicator', new_column_name='dullness_index')


def downgrade():
    op.alter_column('scan_results', 'dullness_index', new_column_name='toxin_indicator')
