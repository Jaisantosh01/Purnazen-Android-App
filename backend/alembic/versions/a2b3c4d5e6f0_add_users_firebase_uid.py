"""add users.firebase_uid for linked social accounts

Revision ID: a2b3c4d5e6f0
Revises: f0a1b2c3d4e5
Create Date: 2026-07-08
"""
import sqlalchemy as sa
from alembic import op

revision = "a2b3c4d5e6f0"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("firebase_uid", sa.String(length=128), nullable=True))
    op.create_unique_constraint("uq_users_firebase_uid", "users", ["firebase_uid"])


def downgrade():
    op.drop_constraint("uq_users_firebase_uid", "users", type_="unique")
    op.drop_column("users", "firebase_uid")
