"""create support_faqs table

Revision ID: 37e4a29764b1
Revises: 8a1b2c3d4e5f
Create Date: 2026-07-04 11:00:56.930242

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '37e4a29764b1'
down_revision = '8a1b2c3d4e5f'
branch_labels = None
depends_on = None


from app.db.types import GUID

def upgrade():
    op.create_table(
        'support_faqs',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('question', sa.String(255), nullable=False),
        sa.Column('answer', sa.Text, nullable=False),
        sa.Column('sort_order', sa.Integer, default=0),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_by', GUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column('updated_by', GUID(), sa.ForeignKey("users.id"), nullable=True),
    )

def downgrade():
    op.drop_table('support_faqs')
