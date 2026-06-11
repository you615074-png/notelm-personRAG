import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, PlainTextResponse

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatCitation,
    ChatMessage,
    ConversationSyncRequest,
)
from app.services.rag import generate_answer, generate_answer_stream
from app.config import get_settings

router = APIRouter(prefix="/api/chat", tags=["chat"])

settings = get_settings()
CONVERSATIONS_DIR = os.path.join(settings.data_dir, "conversations")
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)


def _load_conversations(notebook_id: str) -> list[dict]:
    conv_file = os.path.join(CONVERSATIONS_DIR, f"{notebook_id}.json")
    if not os.path.exists(conv_file):
        return []
    with open(conv_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_conversations(notebook_id: str, messages: list[dict]):
    conv_file = os.path.join(CONVERSATIONS_DIR, f"{notebook_id}.json")
    with open(conv_file, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2, ensure_ascii=False)


def _get_notebook_name(notebook_id: str) -> str:
    """Look up notebook name from metadata, falling back to the raw ID."""
    meta_path = os.path.join(settings.data_dir, "notebooks_meta.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        return meta.get(notebook_id, {}).get("name", notebook_id)
    return notebook_id


def _notebook_exists(notebook_id: str) -> bool:
    """Check if a notebook exists in metadata."""
    meta_path = os.path.join(settings.data_dir, "notebooks_meta.json")
    if not os.path.exists(meta_path):
        return False
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return notebook_id in meta


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest):
    result = await generate_answer(
        body.notebook_id,
        body.message,
        body.top_k,
        body.chat_history,
    )
    citations = [
        ChatCitation(
            index=c["index"],
            source=c["source"],
            page=c.get("page"),
            snippet=c["snippet"],
        )
        for c in result.get("citations", [])
    ]
    return ChatResponse(answer=result["answer"], citations=citations)


@router.post("/stream")
async def chat_stream(body: ChatRequest):
    async def event_generator():
        try:
            async for chunk in generate_answer_stream(
                body.notebook_id,
                body.message,
                body.top_k,
                body.chat_history,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sync")
async def sync_conversation(body: ConversationSyncRequest):
    """Save conversation messages from the frontend to server-side storage."""
    if not _notebook_exists(body.notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    messages_data = [m.model_dump() for m in body.messages]
    _save_conversations(body.notebook_id, messages_data)
    return {"ok": True, "message_count": len(messages_data)}


@router.get("/export/{notebook_id}")
async def export_conversation(notebook_id: str):
    """Export a notebook's conversation history as formatted Markdown."""
    conversations = _load_conversations(notebook_id)
    if not conversations:
        raise HTTPException(status_code=404, detail="No conversations found for this notebook")

    notebook_name = _get_notebook_name(notebook_id)

    export_date = _now()
    lines = [
        f"# {notebook_name}",
        "",
        f"**Exported:** {export_date}",
        "",
        "---",
        "",
        "## Conversation",
        "",
    ]

    citation_index = 0
    footnotes: list[str] = []

    for msg in conversations:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        timestamp = msg.get("timestamp", "")
        citations = msg.get("citations", [])

        if role == "user":
            lines.append(f"### 👤 User — {timestamp}")
        elif role == "assistant":
            lines.append(f"### 🤖 Assistant — {timestamp}")
        else:
            lines.append(f"### {role.capitalize()} — {timestamp}")

        lines.append("")
        lines.append(content)
        lines.append("")

        if citations:
            lines.append("**Citations:**")
            for cit in citations:
                citation_index += 1
                source = cit.get("source", "unknown")
                page = cit.get("page")
                snippet = cit.get("snippet", "")
                page_info = f" (page {page})" if page is not None else ""
                footnote = f"[^{citation_index}]: {source}{page_info} — _{snippet}_"
                footnotes.append(footnote)
                lines.append(f"  [^{citation_index}] {source}{page_info}")
            lines.append("")

        lines.append("---")
        lines.append("")

    if footnotes:
        lines.append("## Citation Details")
        lines.append("")
        for fn in footnotes:
            lines.append(fn)
        lines.append("")

    markdown = "\n".join(lines)
    filename = f"{notebook_name.replace(' ', '_')}_conversation.md"

    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
