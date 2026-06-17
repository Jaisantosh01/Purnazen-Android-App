from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.chat_service import ChatService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get(
    "/flow/start",
    summary="Get starting chat flow",
    description="Fetches the chat flow starting from the designated 'is_start' question.",
)
def get_start_chat_flow(db: Session = Depends(get_db)):
    from app.models.chat_question import ChatQuestion
    start_q = db.query(ChatQuestion).filter_by(is_start=True).first()
    if not start_q:
        return error_response("No starting chat question found", 404)
    
    flow = ChatService.get_flow(db, start_q.id)
    return success_response("Starting chat flow fetched successfully", flow)


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
