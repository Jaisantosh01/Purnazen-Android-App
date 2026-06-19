"""create user_preferences table

Revision ID: e6f3a82d4c91
Revises: d9e2b53a8c47
Create Date: 2026-06-12 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e6f3a82d4c91'
down_revision = 'd9e2b53a8c47'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_preferences',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('push_enabled', sa.Boolean(), nullable=False),
    sa.Column('notifications', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )


def downgrade():
    op.drop_table('user_preferences')
