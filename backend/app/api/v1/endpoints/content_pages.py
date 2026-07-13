from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.content_page import ALLOWED_CONTENT_TYPES, ContentPage
from app.models.role import Role
from app.models.user import User
from app.utils.responses import success_response

router = APIRouter(prefix="/content-pages", tags=["Content Pages"])


class ContentPageCreate(BaseModel):
    type: str
    role_ids: list[str]
    title: str
    content: str
    version: str = "1.0"
    is_active: bool = True


class ContentPageUpdate(BaseModel):
    role_id: str | None = None
    title: str | None = None
    content: str | None = None
    version: str | None = None
    is_active: bool | None = None


@router.get("", summary="List content pages (admin)", dependencies=[Depends(require_role("admin"))])
def list_content_pages(
    type: str | None = None,
    role_id: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(ContentPage).order_by(ContentPage.created_at.desc())
    if type:
        query = query.filter(ContentPage.type == type)
    if role_id:
        query = query.filter(ContentPage.role_id == role_id)
    if is_active is not None:
        query = query.filter(ContentPage.is_active == is_active)
    pages = query.all()
    return success_response("Content pages fetched successfully", [p.to_dict() for p in pages])


@router.get("/{content_type}", summary="Get active content page by type and role")
def get_content_page(
    content_type: str,
    role_id: str | None = None,
    db: Session = Depends(get_db),
):
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}")

    query = db.query(ContentPage).filter(
        ContentPage.type == content_type,
        ContentPage.is_active == True,
    )
    if role_id:
        query = query.filter(ContentPage.role_id == role_id)

    page = query.order_by(ContentPage.created_at.desc()).first()

    if not page:
        raise HTTPException(status_code=404, detail=f"No active {content_type} page found for this role")

    return success_response(f"{content_type} page fetched successfully", page.to_dict())


@router.post("", summary="Create content pages (admin only)", dependencies=[Depends(require_role("admin"))])
def create_content_page(
    body: ContentPageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}")

    if not body.role_ids:
        raise HTTPException(status_code=400, detail="At least one role_id is required")

    role_ids = set(body.role_ids)
    existing_roles = {str(r.id) for r in db.query(Role.id).filter(Role.id.in_(role_ids)).all()}
    invalid = role_ids - existing_roles
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid role_ids: {', '.join(invalid)}")

    created = []
    for role_id in role_ids:
        existing = db.query(ContentPage).filter(
            ContentPage.type == body.type,
            ContentPage.role_id == role_id,
            ContentPage.is_active == True,
        ).all()
        for e in existing:
            e.is_active = False
            e.updated_by = user.id

        page = ContentPage(
            type=body.type,
            role_id=role_id,
            title=body.title,
            content=body.content,
            version=body.version,
            is_active=body.is_active,
            created_by=user.id,
        )
        db.add(page)
        created.append(page)

    db.commit()
    for p in created:
        db.refresh(p)
    return success_response("Content pages created successfully", [p.to_dict() for p in created], status_code=201)


@router.put("/{content_id}", summary="Update a content page (admin only)", dependencies=[Depends(require_role("admin"))])
def update_content_page(
    content_id: str,
    body: ContentPageUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    page = db.get(ContentPage, content_id)
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")

    update_data = body.model_dump(exclude_unset=True)
    if "role_id" in update_data:
        role_exists = db.query(Role.id).filter(Role.id == body.role_id).first()
        if not role_exists:
            raise HTTPException(status_code=400, detail="Invalid role_id")

    for field, value in update_data.items():
        setattr(page, field, value)
    page.updated_by = user.id

    db.commit()
    db.refresh(page)
    return success_response("Content page updated successfully", page.to_dict())


@router.delete("/{content_id}", summary="Soft delete a content page (admin only)", dependencies=[Depends(require_role("admin"))])
def delete_content_page(
    content_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    page = db.get(ContentPage, content_id)
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")

    page.is_active = False
    page.updated_by = user.id
    db.commit()
    return success_response("Content page deactivated successfully")
