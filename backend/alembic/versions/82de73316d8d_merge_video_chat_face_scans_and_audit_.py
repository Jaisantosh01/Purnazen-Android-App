"""merge video_chat, face_scans, and audit branches

Revision ID: 82de73316d8d
Revises: 856c85ff7105, a7b8c9d0e1f2, b3bec455c884
Create Date: 2026-06-17 12:05:50.698322

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '82de73316d8d'
down_revision = ('856c85ff7105', 'a7b8c9d0e1f2', 'b3bec455c884')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
