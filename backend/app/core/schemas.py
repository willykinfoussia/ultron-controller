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


class SystemProcessesQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    sort: str = Field(default="cpu", pattern="^(cpu|memory)$")


class StorageScanQuery(BaseModel):
    path: str = Field(min_length=1, max_length=2048)
    depth: int = Field(default=4, ge=1, le=16)
    limit: int = Field(default=10, ge=1, le=100)
