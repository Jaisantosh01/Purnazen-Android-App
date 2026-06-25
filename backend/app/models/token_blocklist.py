from sqlalchemy import Column, DateTime, Integer, String, func
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class TokenBlocklist(Base):
    __tablename__ = "token_blocklist"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    jti = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
