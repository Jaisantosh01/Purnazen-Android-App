import uuid

from sqlalchemy.orm import Session, joinedload

from app.models.chat_question import ChatQuestion
from app.models.chat_option import ChatOption


class ChatRepository:
    @staticmethod
    def get_question(db: Session, question_id: uuid.UUID) -> ChatQuestion | None:
        return (
            db.query(ChatQuestion)
            .options(joinedload(ChatQuestion.options))
            .filter(ChatQuestion.id == question_id)
            .first()
        )

    @staticmethod
    def get_full_flow(db: Session, start_question_id: uuid.UUID) -> list[ChatQuestion]:
        """
        Fetches all questions in a flow starting from a given ID.
        Uses a BFS-like approach to find all reachable questions to avoid infinite recursion
        but keep it simple for a decision tree.
        """
        questions = []
        to_visit = [start_question_id]
        visited = set()

        while to_visit:
            current_id = to_visit.pop(0)
            if current_id in visited:
                continue
            
            question = (
                db.query(ChatQuestion)
                .options(joinedload(ChatQuestion.options))
                .filter(ChatQuestion.id == current_id)
                .first()
            )
            
            if question:
                questions.append(question)
                visited.add(current_id)
                for option in question.options:
                    if option.next_question_id and option.next_question_id not in visited:
                        to_visit.append(option.next_question_id)
        
        return questions
