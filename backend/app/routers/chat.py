import json
import os
import uuid
import logging
from datetime import datetime, timezone

from openai import OpenAI
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, PlainTextResponse

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatCitation,
    ChatMessage,
    ConversationSyncRequest,
    SuggestedQuestionsRequest,
    SuggestedQuestionsResponse,
    UpdateConversationTitleRequest,
)
from app.services.rag import generate_answer, generate_answer_stream
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

settings = get_settings()
CONVERSATIONS_DIR = os.path.join(settings.data_dir, "conversations")
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

CONV_META_DIR = os.path.join(settings.data_dir, "conversations_meta")
os.makedirs(CONV_META_DIR, exist_ok=True)


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


def _load_conv_meta(notebook_id: str) -> dict:
    """Load conversation metadata for a notebook."""
    meta_file = os.path.join(CONV_META_DIR, f"{notebook_id}.json")
    if not os.path.exists(meta_file):
        return {"conversations": {}}
    with open(meta_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_conv_meta(notebook_id: str, meta: dict):
    """Save conversation metadata for a notebook."""
    meta_file = os.path.join(CONV_META_DIR, f"{notebook_id}.json")
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def _generate_title(text: str, max_chars: int = 50) -> str:
    """Generate a conversation title via smart truncation at a word boundary."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > 0:
        return truncated[:last_space] + "…"
    return truncated + "…"


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


GENERIC_QUESTIONS = [
    "What are the main topics covered in these documents?",
    "Can you summarize the key points?",
    "What are the most important takeaways?",
    "How do these documents relate to each other?",
    "What specific examples or data are provided?",
    "What conclusions or recommendations are made?",
    "Are there any key definitions I should know?",
    "What is the overall structure of these documents?",
]


async def _generate_suggested_questions(notebook_id: str, count: int) -> list[str]:
    """Generate suggested questions based on notebook document content.

    Uses a generic probe query to find representative chunks from the notebook,
    then asks the LLM to generate contextually relevant starter questions.
    Falls back to generic questions when no documents are uploaded or the LLM
    is unavailable.
    """
    from app.services.embedder import embed_query
    from app.database import query_chunks

    # Use a generic probe query to find representative document chunks
    settings = get_settings()
    probe_embedding = embed_query(
        "key concepts main ideas overview summary topics highlights"
    )

    if probe_embedding is None:
        return GENERIC_QUESTIONS[:count]

    results = query_chunks(notebook_id, probe_embedding, top_k=5)

    if not results:
        return GENERIC_QUESTIONS[:count]

    # Build a context summary from the retrieved chunks
    context_parts = []
    for item in results:
        meta = item.get("metadata", {})
        source = meta.get("source", meta.get("filename", "unknown"))
        context_parts.append(f"--- From: {source} ---\n{item['text'][:500]}")
    context = "\n\n".join(context_parts)

    if not settings.is_llm_configured:
        return GENERIC_QUESTIONS[:count]

    try:
        client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
        resp = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a helpful assistant. Based on the provided document excerpts, "
                        f"generate exactly {count} starter questions that a user might want to ask "
                        f"about these documents. The questions should be diverse, covering different "
                        f"aspects of the content. Each question should be concise (under 100 chars). "
                        f"Output ONLY the questions, one per line, with no numbering, bullets, or prefixes. "
                        f"Do not include any other text."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Here are excerpts from the documents:\n\n{context}\n\nGenerate {count} starter questions.",
                },
            ],
            temperature=0.7,
            max_tokens=500,
        )
        raw = resp.choices[0].message.content.strip()
        questions = [
            q.strip().lstrip("-.•*0123456789) ")
            for q in raw.split("\n")
            if q.strip()
        ]
        # Keep only meaningful questions and truncate to requested count
        questions = [q for q in questions if len(q) > 5][:count]
        if len(questions) < count:
            questions += GENERIC_QUESTIONS[: (count - len(questions))]
        return questions
    except Exception as e:
        logger.warning(f"Failed to generate suggested questions: {e}")
        return GENERIC_QUESTIONS[:count]


@router.post("/suggested-questions", response_model=SuggestedQuestionsResponse)
async def suggested_questions(body: SuggestedQuestionsRequest):
    """Generate starter questions based on notebook document content.

    Returns 3-5 contextually relevant questions when documents are uploaded,
    or generic starter questions when the notebook is empty.
    """
    if not _notebook_exists(body.notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    questions = await _generate_suggested_questions(body.notebook_id, body.count)
    return SuggestedQuestionsResponse(questions=questions)


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
    """Save conversation messages from the frontend to server-side storage.

    Auto-generates a conversation title from the first user message when no
    conversation metadata exists yet for this notebook.
    """
    if not _notebook_exists(body.notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    messages_data = [m.model_dump() for m in body.messages]
    _save_conversations(body.notebook_id, messages_data)

    # Auto-generate conversation title from first user message
    conv_meta = _load_conv_meta(body.notebook_id)
    if not conv_meta.get("conversations"):
        first_user_msg = next(
            (m for m in messages_data if m.get("role") == "user"), None
        )
        if first_user_msg:
            conv_id = str(uuid.uuid4())
            conv_meta["conversations"][conv_id] = {
                "title": _generate_title(first_user_msg["content"]),
                "pinned": False,
                "created_at": _now(),
            }
            _save_conv_meta(body.notebook_id, conv_meta)

    return {
        "ok": True,
        "message_count": len(messages_data),
        "conversations": list(conv_meta.get("conversations", {}).values()),
    }


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


# Separate router for conversation metadata endpoints (under /api/notebooks prefix)
conv_router = APIRouter(prefix="/api/notebooks", tags=["conversations"])


@conv_router.patch("/{notebook_id}/conversation/{conv_id}/title")
async def update_conversation_title(
    notebook_id: str, conv_id: str, body: UpdateConversationTitleRequest
):
    """Manually edit a conversation's auto-generated title."""
    if not _notebook_exists(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    meta = _load_conv_meta(notebook_id)
    conversations = meta.get("conversations", {})
    if conv_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversations[conv_id]["title"] = body.title
    _save_conv_meta(notebook_id, meta)
    return {"ok": True}
