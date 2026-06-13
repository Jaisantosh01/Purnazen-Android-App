from sqlalchemy import Column, DateTime, Integer, String, func

from app.db.base_class import Base


class TokenBlocklist(Base):
    __tablename__ = "token_blocklist"

    id = Column(Integer, primary_key=True)
    jti = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
