from app.extensions.database import db

class QuickRelief(db.Model):

    __tablename__ = "quick_reliefs"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(100), nullable=False, unique=True)

    title = db.Column(db.String(150), nullable=False)
    subtitle = db.Column(db.String(255))

    icon_name = db.Column(db.String(100))
    icon_url = db.Column(db.String(500))

    background_color = db.Column(db.String(20))
    text_color = db.Column(db.String(20))

    description = db.Column(db.Text)

    sort_order = db.Column(db.Integer, default=0)

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now()
    )

    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        onupdate=db.func.now()
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'title': self.title,
            'subtitle': self.subtitle,
            'icon_name': self.icon_name,
            'icon_url': self.icon_url,
            'background_color': self.background_color,
            'text_color': self.text_color,
            'description': self.description,
            'sort_order': self.sort_order,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }