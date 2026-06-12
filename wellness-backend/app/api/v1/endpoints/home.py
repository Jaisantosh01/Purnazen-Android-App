from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.home_service import HomeService

router = APIRouter(prefix="/home", tags=["Home"])


@router.get("/quick-relief")
def get_quick_relief(db: Session = Depends(get_db)):
    return {"data": HomeService.get_quick_reliefs(db)}
