"""Drop orphan association tables doctor_languages and doctor_expertise

Revision ID: a1b2c3d4e5f6
Revises: f6e7d8c9b0a1
Create Date: 2026-06-19 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f6e7d8c9b0a1'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('doctor_expertise')
    op.drop_table('doctor_languages')


def downgrade():
    op.create_table('doctor_languages',
        sa.Column('doctor_id', sa.UUID(), nullable=False),
        sa.Column('language_id', sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint('doctor_id', 'language_id'),
    )
    op.create_table('doctor_expertise',
        sa.Column('doctor_id', sa.UUID(), nullable=False),
        sa.Column('expertise_id', sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint('doctor_id', 'expertise_id'),
    )
