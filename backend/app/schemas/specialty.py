from pydantic import BaseModel


class SpecialtyCreate(BaseModel):
    name: str
    description: str | None = None


class SpecialtyUpdate(BaseModel):
    name: str
    description: str | None = None