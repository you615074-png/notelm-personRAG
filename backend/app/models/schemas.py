from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class NotebookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    tags: list[str] = Field(default_factory=list)


class NotebookUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    tags: Optional[list[str]] = None


class NotebookResponse(BaseModel):
    id: str
    name: str
    tags: list[str] = Field(default_factory=list)
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
    title: Optional[str] = None
    pinned: bool = False


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    citations: list[ChatCitation] = Field(default_factory=list)
    timestamp: str
    title: Optional[str] = None
    pinned: bool = False


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


class ConversationSyncRequest(BaseModel):
    notebook_id: str
    messages: list[ChatMessage]


class SearchResult(BaseModel):
    snippet: str
    source: str
    notebook_id: str
    notebook_name: str


class SuggestedQuestionsRequest(BaseModel):
    notebook_id: str
    count: int = Field(default=4, ge=1, le=8)


class SuggestedQuestionsResponse(BaseModel):
    questions: list[str]


class SettingsResponse(BaseModel):
    llm_base_url: str
    llm_api_key_set: bool
    llm_model: str
    embed_base_url: str
    embed_api_key_set: bool
    embed_model: str


class DocumentSummaryResponse(BaseModel):
    doc_id: str
    summary: str
    cached: bool


class NotebookSummaryResponse(BaseModel):
    notebook_id: str
    summary: str
    cached: bool
