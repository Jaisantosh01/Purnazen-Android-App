"""add therapy_session_groups table and session_group_id columns

Revision ID: d5e6f7a8b9c0
Revises: 026325187c4c
Create Date: 2026-07-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from app.db.types import GUID
import uuid


# revision identifiers, used by Alembic.
revision = 'd5e6f7a8b9c0'
down_revision = '026325187c4c'
branch_labels = None
depends_on = None


def upgrade():
    # Create therapy_session_groups table
    op.create_table(
        "therapy_session_groups",
        sa.Column("id", GUID(), primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column("user_id", GUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("group_id", GUID(), sa.ForeignKey("video_groups.id"), nullable=False),
        sa.Column("session_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(
        "ix_therapy_session_groups_user_group",
        "therapy_session_groups",
        ["user_id", "group_id", "session_type"],
    )

    # Add session_group_id to therapy_sessions (nullable initially)
    op.add_column(
        "therapy_sessions",
        sa.Column("session_group_id", GUID(), sa.ForeignKey("therapy_session_groups.id"), nullable=True),
    )

    # Add session_group_id to therapy_feedback (nullable initially)
    op.add_column(
        "therapy_feedback",
        sa.Column("session_group_id", GUID(), sa.ForeignKey("therapy_session_groups.id"), nullable=True),
    )

    # ---- Migrate existing data into session groups ----
    # Group existing therapy_sessions by (user_id, group_id, session_type)
    # and create one TherapySessionGroup per unique combo
    conn = op.get_bind()

    # Get distinct user+group+type combos
    rows = conn.execute(
        sa.text("""
            SELECT DISTINCT user_id, group_id, session_type
            FROM therapy_sessions
        """)
    ).fetchall()

    for user_id, group_id, session_type in rows:
        # Create a session group
        sg_id = uuid.uuid4()
        conn.execute(
            sa.text("""
                INSERT INTO therapy_session_groups (id, user_id, group_id, session_type, status)
                VALUES (:id, :user_id, :group_id, :session_type, 'completed')
            """),
            {"id": sg_id, "user_id": user_id, "group_id": group_id, "session_type": session_type},
        )

        # Link all therapy_sessions for this combo to the new session group
        conn.execute(
            sa.text("""
                UPDATE therapy_sessions
                SET session_group_id = :sg_id
                WHERE user_id = :user_id AND group_id = :group_id AND session_type = :session_type
            """),
            {"sg_id": sg_id, "user_id": user_id, "group_id": group_id, "session_type": session_type},
        )

        # Link existing therapy_feedback for this group to the session group
        conn.execute(
            sa.text("""
                UPDATE therapy_feedback
                SET session_group_id = :sg_id
                WHERE user_id = :user_id AND video_group_id = :group_id
            """),
            {"sg_id": sg_id, "user_id": user_id, "group_id": group_id},
        )

    # Drop old index on therapy_sessions and create new one
    op.drop_index("ix_therapy_sessions_user_group_video", table_name="therapy_sessions")
    op.create_index(
        "ix_therapy_sessions_user_group_video_session",
        "therapy_sessions",
        ["user_id", "group_id", "video_id", "session_group_id"],
    )


def downgrade():
    op.drop_index("ix_therapy_sessions_user_group_video_session", table_name="therapy_sessions")
    op.create_index(
        "ix_therapy_sessions_user_group_video",
        "therapy_sessions",
        ["user_id", "group_id", "video_id"],
    )
    op.drop_column("therapy_feedback", "session_group_id")
    op.drop_column("therapy_sessions", "session_group_id")
    op.drop_index("ix_therapy_session_groups_user_group", table_name="therapy_session_groups")
    op.drop_table("therapy_session_groups")
