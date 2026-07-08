"""create app_releases table

Backs OTA distribution: each row is a signed APK published to the private
releases blob container; the backend serves the latest version + a short-lived
SAS download URL to the in-app updater.

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-06-26 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.db.types import GUID


revision = 'a4b5c6d7e8f9'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'app_releases',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('app_slug', sa.String(40), nullable=False),
        sa.Column('version', sa.String(20), nullable=False),
        sa.Column('version_code', sa.Integer(), nullable=True),
        sa.Column('apk_blob_path', sa.String(255), nullable=False),
        sa.Column('sha256', sa.String(64), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('forced', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', GUID(), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('app_slug', 'version', name='uq_app_releases_slug_version'),
    )
    op.create_index('ix_app_releases_app_slug', 'app_releases', ['app_slug'])


def downgrade():
    op.drop_index('ix_app_releases_app_slug', table_name='app_releases')
    op.drop_table('app_releases')
