from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from app.db.base_class import Base


class QuickRelief(Base):
    __tablename__ = "quick_reliefs"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    title = Column(String(150), nullable=False)
    subtitle = Column(String(255))
    icon_name = Column(String(100))
    icon_url = Column(String(500))
    background_color = Column(String(20))
    text_color = Column(String(20))
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "title": self.title,
            "subtitle": self.subtitle,
            "icon_name": self.icon_name,
            "icon_url": self.icon_url,
            "background_color": self.background_color,
            "text_color": self.text_color,
            "description": self.description,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
