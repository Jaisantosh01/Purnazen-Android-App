from sqlalchemy.orm import Session
from app.repositories.chat_repository import ChatRepository


class ChatService:
    @staticmethod
    def get_flow(db: Session, start_question_id: int):
        questions = ChatRepository.get_full_flow(db, start_question_id)
        if not questions:
            return None
        
        # We return a flattened list indexed by ID for easy client-side lookup
        return {str(q.id): q.to_dict() for q in questions}
