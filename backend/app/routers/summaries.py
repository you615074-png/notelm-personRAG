import hashlib
import json
import os
import logging
from datetime import datetime, timezone

from openai import OpenAI
from fastapi import APIRouter, HTTPException

from app.models.schemas import DocumentSummaryResponse, NotebookSummaryResponse
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["summaries"])

settings = get_settings()
SUMMARIES_DIR = os.path.join(settings.data_dir, "summaries")
os.makedirs(SUMMARIES_DIR, exist_ok=True)

DOC_META_FILE = os.path.join(settings.data_dir, "documents_meta.json")
NB_META_FILE = os.path.join(settings.data_dir, "notebooks_meta.json")


def _load_doc_meta() -> dict:
    if not os.path.exists(DOC_META_FILE):
        return {}
    with open(DOC_META_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _notebook_exists(notebook_id: str) -> bool:
    if not os.path.exists(NB_META_FILE):
        return False
    with open(NB_META_FILE, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return notebook_id in meta


def _compute_chunks_hash(chunks: list[str]) -> str:
    """Compute a content hash from chunk texts to detect content changes."""
    combined = "\n".join(sorted(chunks))
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def _load_summary_cache(key: str) -> dict | None:
    """Load a cached summary if it exists."""
    cache_file = os.path.join(SUMMARIES_DIR, f"{key}.json")
    if not os.path.exists(cache_file):
        return None
    with open(cache_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_summary_cache(key: str, data: dict):
    """Save a summary to cache."""
    cache_file = os.path.join(SUMMARIES_DIR, f"{key}.json")
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


async def _generate_summary(context: str, title: str, settings) -> str:
    """Call the LLM to generate a summary of the provided context.

    Falls back to an extractive summary snippet when the LLM is unavailable.
    """
    if not settings.is_llm_configured:
        # Simple extractive fallback: first 300 chars of context as a preview
        preview = context[:300].strip()
        if len(context) > 300:
            preview += "…"
        return preview

    prompt_context = context[:6000]  # limit tokens sent to LLM

    try:
        client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
        resp = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise summarization assistant. Generate a clear, "
                        "concise summary (3-5 paragraphs) of the provided document content. "
                        "Focus on key topics, main arguments, important data points, and "
                        "conclusions. Use plain language and avoid filler. "
                        "Output ONLY the summary text, no headings or prefixes."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Summarize the following content from \"{title}\":\n\n{prompt_context}",
                },
            ],
            temperature=0.3,
            max_tokens=800,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"LLM summary generation failed: {e}")
        # Fallback: return first portion of context as preview
        preview = context[:300].strip()
        if len(context) > 300:
            preview += "…"
        return preview


@router.post("/documents/{doc_id}/summarize", response_model=DocumentSummaryResponse)
async def summarize_document(doc_id: str):
    """Generate or retrieve a summary for a single document.

    Uses content-hash caching: regenerates the summary only when the document
    content has changed since the last summarization.
    """
    from app.database import get_or_create_collection

    doc_meta = _load_doc_meta()
    if doc_id not in doc_meta:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_info = doc_meta[doc_id]
    notebook_id = doc_info.get("notebook_id")
    if not notebook_id:
        raise HTTPException(status_code=404, detail="Document not associated with any notebook")

    filename = doc_info.get("filename", "unknown")

    # Retrieve all chunks for this document
    col = get_or_create_collection(notebook_id)
    try:
        results = col.get(where={"doc_id": doc_id}, include=["documents"])
        chunks = results["documents"] if results["ids"] else []
    except Exception:
        chunks = []

    if not chunks:
        raise HTTPException(status_code=400, detail="Document has no content to summarize")

    # Compute content hash and check cache
    content_hash = _compute_chunks_hash(chunks)
    cache_key = f"doc_{doc_id}"
    cached = _load_summary_cache(cache_key)

    if cached and cached.get("content_hash") == content_hash:
        return DocumentSummaryResponse(
            doc_id=doc_id,
            summary=cached["summary"],
            cached=True,
        )

    # Build full document context from chunks
    context = "\n\n".join(chunks)

    stg = get_settings()
    summary = await _generate_summary(context, filename, stg)

    # Persist to cache
    _save_summary_cache(cache_key, {
        "doc_id": doc_id,
        "summary": summary,
        "content_hash": content_hash,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })

    return DocumentSummaryResponse(
        doc_id=doc_id,
        summary=summary,
        cached=False,
    )


@router.post("/notebooks/{notebook_id}/summarize", response_model=NotebookSummaryResponse)
async def summarize_notebook(notebook_id: str):
    """Generate or retrieve an overview summary of all documents in a notebook.

    Uses content-hash caching: regenerates the summary only when any document
    content has changed since the last summarization.
    """
    from app.services.embedder import embed_query
    from app.database import query_chunks, get_or_create_collection

    if not _notebook_exists(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")

    # Collect all document chunks from the notebook to compute content hash
    doc_meta = _load_doc_meta()
    notebook_docs = [
        (did, info) for did, info in doc_meta.items()
        if info.get("notebook_id") == notebook_id
    ]

    if not notebook_docs:
        raise HTTPException(status_code=400, detail="Notebook has no documents to summarize")

    col = get_or_create_collection(notebook_id)
    all_chunks: list[str] = []
    for doc_id, _ in notebook_docs:
        try:
            results = col.get(where={"doc_id": doc_id}, include=["documents"])
            if results["ids"] and results["documents"]:
                all_chunks.extend(results["documents"])
        except Exception:
            pass

    if not all_chunks:
        raise HTTPException(status_code=400, detail="Notebook has no content to summarize")

    # Compute content hash and check cache
    content_hash = _compute_chunks_hash(all_chunks)
    cache_key = f"nb_{notebook_id}"
    cached = _load_summary_cache(cache_key)

    if cached and cached.get("content_hash") == content_hash:
        return NotebookSummaryResponse(
            notebook_id=notebook_id,
            summary=cached["summary"],
            cached=True,
        )

    # Use a probe embedding to find representative chunks for the LLM context
    stg = get_settings()
    probe_embedding = embed_query(
        "key concepts main ideas overview summary topics highlights"
    )

    if probe_embedding is not None:
        results = query_chunks(notebook_id, probe_embedding, top_k=8)
        if results:
            context_parts = []
            for item in results:
                meta = item.get("metadata", {})
                source = meta.get("source", meta.get("filename", "unknown"))
                context_parts.append(f"--- From: {source} ---\n{item['text'][:600]}")
            context = "\n\n".join(context_parts)
        else:
            # Fallback: use first chunks directly
            context = "\n\n".join(all_chunks[:20])
    else:
        context = "\n\n".join(all_chunks[:20])

    nb_name = _get_notebook_name(notebook_id)
    summary = await _generate_summary(context, nb_name, stg)

    # Persist to cache
    _save_summary_cache(cache_key, {
        "notebook_id": notebook_id,
        "summary": summary,
        "content_hash": content_hash,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })

    return NotebookSummaryResponse(
        notebook_id=notebook_id,
        summary=summary,
        cached=False,
    )


def _get_notebook_name(notebook_id: str) -> str:
    """Look up notebook name from metadata."""
    if not os.path.exists(NB_META_FILE):
        return notebook_id
    with open(NB_META_FILE, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return meta.get(notebook_id, {}).get("name", notebook_id)
