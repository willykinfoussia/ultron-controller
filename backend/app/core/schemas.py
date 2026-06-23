from pydantic import BaseModel, ConfigDict, Field


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


class StorageAnalyzeQuery(BaseModel):
    path: str = Field(min_length=1, max_length=2048)
    depth: int = Field(default=4, ge=1, le=16)
    limit: int = Field(default=20, ge=1, le=100)
    old_days: int = Field(default=180, ge=1, le=3650)
    min_size: int = Field(default=1024 * 1024, ge=0, le=1024 * 1024 * 1024)


# ── Hermes API Server schemas ─────────────────────────────────────────────────

class HermesChatMessageContentPart(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: str
    text: str | None = None
    image_url: dict | None = None


class HermesChatMessage(BaseModel):
    model_config = ConfigDict(extra="allow")
    role: str
    content: str | list[HermesChatMessageContentPart]


class HermesChatRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str = "hermes-agent"
    messages: list[HermesChatMessage]
    stream: bool = False


class HermesResponseRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str = "hermes-agent"
    input: str | list[dict]
    instructions: str | None = None
    store: bool = True
    previous_response_id: str | None = None
    conversation: str | None = None


class HermesRunRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    input: str
    session_id: str | None = None
    instructions: str | None = None
    previous_response_id: str | None = None


class HermesJobCreate(BaseModel):
    model_config = ConfigDict(extra="allow")
    prompt: str
    schedule: str | None = None


class HermesJobUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")


class HermesAgentSessionCreate(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: str | None = None


class HermesAgentSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: str | None = None
    end_reason: str | None = None


class HermesSessionChatRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    input: str
