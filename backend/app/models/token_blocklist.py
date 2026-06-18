from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base


class TokenBlocklist(Base):
    __tablename__ = "token_blocklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    jti = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
