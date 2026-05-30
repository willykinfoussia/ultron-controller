from pydantic import BaseModel, Field


class ContentWrite(BaseModel):
    content: str
    mode: str = Field(default="replace", pattern="^(replace|append|create)$")


class OvContentWrite(BaseModel):
    uri: str
    content: str
    mode: str = Field(default="replace", pattern="^(replace|append|create)$")


class DirCreate(BaseModel):
    uri: str
    description: str | None = None


class SearchQuery(BaseModel):
    query: str
    target_uri: str = ""
    limit: int = Field(default=20, ge=1, le=200)
    score_threshold: float | None = None


class SessionSearchQuery(BaseModel):
    query: str
    limit: int = Field(default=20, ge=1, le=200)
