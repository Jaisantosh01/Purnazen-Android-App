"""drop the APK distribution columns from app_releases

The apps are distributed through Play and the App Store now; the in-app
self-updater that downloaded a signed APK from a private blob container is
gone (Play's Device and Network Abuse policy forbids it). What remains is a
published-version registry, so the blob path and the APK checksum have nothing
left to describe.

Revision ID: a1c0ffee0001
Revises: d1c2b3a4e5f6
Create Date: 2026-09-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1c0ffee0001'
down_revision = 'd1c2b3a4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('app_releases', 'apk_blob_path')
    op.drop_column('app_releases', 'sha256')


def downgrade():
    # Re-created nullable: the paths they used to hold are gone with the
    # container, so there is nothing to backfill.
    op.add_column('app_releases', sa.Column('sha256', sa.String(64), nullable=True))
    op.add_column('app_releases', sa.Column('apk_blob_path', sa.String(255), nullable=True))
