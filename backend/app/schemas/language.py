from pydantic import BaseModel


class LanguageCreate(BaseModel):
    name: str


class LanguageUpdate(BaseModel):
    name: str