from pydantic import BaseModel


class ExpertiseCreate(BaseModel):
    name: str


class ExpertiseUpdate(BaseModel):
    name: str