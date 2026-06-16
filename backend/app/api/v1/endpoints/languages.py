from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.language import LanguageCreate, LanguageUpdate
from app.services.language_service import LanguageService
from app.utils.responses import error_response, success_response

router = APIRouter(
    prefix="/languages",
    tags=["Languages"],
)

@router.get("")
def get_languages(
    db: Session = Depends(get_db),
):
    return success_response(
        "Languages fetched successfully",
        [language.to_dict() for language in LanguageService.get_all(db)],
    )

@router.post("")
def create_language(
    body: LanguageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    language = LanguageService.create(
        db,
        body.name,
        user,
    )

    return success_response(
        "Language created successfully",
        language.to_dict(),
    )

@router.put("/{language_id}")
def update_language(
    language_id: int,
    body: LanguageUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    language = LanguageService.update(
        db,
        language_id,
        body.name,
        user,
    )

    if not language:
        return error_response("Language not found", 404)

    return success_response(
        "Language updated successfully",
        language.to_dict(),
    )

@router.delete("/{language_id}")
def delete_language(
    language_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    language = LanguageService.delete(
        db,
        language_id,
        user,
    )

    if not language:
        return error_response("Language not found", 404)

    return success_response(
        "Language deleted successfully",
        {},
    )
