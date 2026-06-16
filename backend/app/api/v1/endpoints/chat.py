from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.chat_service import ChatService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get(
    "/flow/{start_question_id}",
    summary="Get chat flow",
    description="Fetches a complete decision tree of questions and options starting from a specific question ID.",
)
def get_chat_flow(start_question_id: int, db: Session = Depends(get_db)):
    flow = ChatService.get_flow(db, start_question_id)
    if not flow:
        return error_response("Chat flow not found", 404)
    
    return success_response("Chat flow fetched successfully", flow)
