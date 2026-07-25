"""add health profile fields to users

Backs the extra "Edit Profile" fields in the patient app and the generated
health report: vitals (blood group / height / weight) plus free-text medical
background the treating doctor can read.

Revision ID: bc23de45fa67
Revises: ab12cd34ef56
Create Date: 2026-07-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'bc23de45fa67'
down_revision = 'ab12cd34ef56'
branch_labels = None
depends_on = None


COLUMNS = (
    ('blood_group', sa.String(5)),
    ('height_cm', sa.Numeric(5, 1)),
    ('weight_kg', sa.Numeric(5, 1)),
    ('allergies', sa.Text()),
    ('conditions', sa.Text()),
    ('medications', sa.Text()),
)


def upgrade():
    for name, type_ in COLUMNS:
        op.add_column('users', sa.Column(name, type_, nullable=True))


def downgrade():
    for name, _ in reversed(COLUMNS):
        op.drop_column('users', name)
