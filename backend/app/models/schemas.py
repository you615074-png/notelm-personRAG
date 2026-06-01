from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class NotebookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class NotebookUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)


class NotebookResponse(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str


class DocumentResponse(BaseModel):
    id: str
    notebook_id: str
    filename: str
    file_type: str
    chunk_count: int
    created_at: str


class ChatRequest(BaseModel):
    notebook_id: str
    message: str = Field(..., min_length=1)
    top_k: Optional[int] = None
    chat_history: Optional[list[dict]] = None


class ChatCitation(BaseModel):
    index: int
    source: str
    page: Optional[int] = None
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[ChatCitation] = []


class WebFetchRequest(BaseModel):
    notebook_id: str
    url: str


class NoteCreate(BaseModel):
    notebook_id: str
    content: str
    title: Optional[str] = None


class NoteResponse(BaseModel):
    id: str
    notebook_id: str
    title: str
    content: str
    created_at: str
    updated_at: str


class SettingsUpdate(BaseModel):
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    embed_base_url: Optional[str] = None
    embed_api_key: Optional[str] = None
    embed_model: Optional[str] = None


class SettingsResponse(BaseModel):
    llm_base_url: str
    llm_api_key_set: bool
    llm_model: str
    embed_base_url: str
    embed_api_key_set: bool
    embed_model: str
