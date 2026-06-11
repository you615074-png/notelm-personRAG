import io
import os
import json
import uuid
import glob
import zipfile
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    NotebookCreate,
    NotebookUpdate,
    NotebookResponse,
    NoteCreate,
    NoteResponse,
)
from app.config import get_settings
from app.database import delete_collection, remove_notebook_from_global_index

router = APIRouter(prefix="/api", tags=["notebooks"])

settings = get_settings()

NOTES_DIR = os.path.join(settings.data_dir, "notes")
os.makedirs(NOTES_DIR, exist_ok=True)

METADATA_FILE = os.path.join(settings.data_dir, "notebooks_meta.json")


def _load_meta() -> dict:
    if not os.path.exists(METADATA_FILE):
        return {}
    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_meta(meta: dict):
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


DOC_META_FILE = os.path.join(settings.data_dir, "documents_meta.json")


def _load_doc_meta() -> dict:
    if not os.path.exists(DOC_META_FILE):
        return {}
    with open(DOC_META_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_doc_meta(meta: dict):
    with open(DOC_META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def _load_notes(notebook_id: str) -> list[dict]:
    notes_file = os.path.join(NOTES_DIR, f"{notebook_id}.json")
    if not os.path.exists(notes_file):
        return []
    with open(notes_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_notes(notebook_id: str, notes: list[dict]):
    notes_file = os.path.join(NOTES_DIR, f"{notebook_id}.json")
    with open(notes_file, "w", encoding="utf-8") as f:
        json.dump(notes, f, indent=2, ensure_ascii=False)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _build_export_conversation_md(notebook_name: str, conversations: list[dict]) -> str:
    """Build a Markdown representation of the notebook's conversation history."""
    if not conversations:
        return f"# {notebook_name}\n\nNo conversations yet.\n"

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

    return "\n".join(lines)


def _build_export_readme(notebook_name: str, metadata: dict) -> str:
    """Build a README.md overview for the notebook export."""
    doc_count = metadata.get("document_count", 0)
    msg_count = metadata.get("conversation_message_count", 0)
    note_count = metadata.get("note_count", 0)
    tags = metadata.get("tags", [])
    exported_at = metadata.get("exported_at", "")
    created_at = metadata.get("created_at", "")

    tag_list = ", ".join(f"`{t}`" for t in tags) if tags else "None"

    lines = [
        f"# {notebook_name}",
        "",
        f"Exported from **Notelm** on {exported_at}.",
        "",
        "## Overview",
        "",
        f"| Property | Value |",
        f"|----------|-------|",
        f"| Created | {created_at} |",
        f"| Tags | {tag_list} |",
        f"| Documents | {doc_count} |",
        f"| Conversation Messages | {msg_count} |",
        f"| Notes | {note_count} |",
        "",
        "## Contents",
        "",
        "- `conversation.md` — Full conversation history with citations",
        "- `metadata.json` — Notebook metadata in JSON format",
        "- `documents/` — Original uploaded documents",
        "",
    ]
    return "\n".join(lines)


@router.get("/notebooks", response_model=list[NotebookResponse])
async def list_notebooks(tag: str = None):
    meta = _load_meta()
    notebooks = []
    for nb_id, nb_data in meta.items():
        nb_tags = nb_data.get("tags", [])
        if tag and tag not in nb_tags:
            continue
        notebooks.append(
            NotebookResponse(
                id=nb_id,
                name=nb_data["name"],
                tags=nb_tags,
                created_at=nb_data["created_at"],
                updated_at=nb_data["updated_at"],
            )
        )
    notebooks.sort(key=lambda x: x.updated_at, reverse=True)
    return notebooks


@router.post("/notebooks", response_model=NotebookResponse)
async def create_notebook(body: NotebookCreate):
    nb_id = str(uuid.uuid4())
    now = _now()
    meta = _load_meta()
    meta[nb_id] = {"name": body.name, "tags": body.tags, "created_at": now, "updated_at": now}
    _save_meta(meta)
    return NotebookResponse(id=nb_id, name=body.name, tags=body.tags, created_at=now, updated_at=now)


@router.get("/notebooks/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(notebook_id: str):
    meta = _load_meta()
    if notebook_id not in meta:
        raise HTTPException(status_code=404, detail="Notebook not found")
    nb = meta[notebook_id]
    return NotebookResponse(
        id=notebook_id,
        name=nb["name"],
        tags=nb.get("tags", []),
        created_at=nb["created_at"],
        updated_at=nb["updated_at"],
    )


@router.patch("/notebooks/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(notebook_id: str, body: NotebookUpdate):
    meta = _load_meta()
    if notebook_id not in meta:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if body.name is not None:
        meta[notebook_id]["name"] = body.name
    if body.tags is not None:
        meta[notebook_id]["tags"] = body.tags
    meta[notebook_id]["updated_at"] = _now()
    _save_meta(meta)
    nb = meta[notebook_id]
    return NotebookResponse(
        id=notebook_id,
        name=nb["name"],
        tags=nb.get("tags", []),
        created_at=nb["created_at"],
        updated_at=nb["updated_at"],
    )


@router.delete("/notebooks/{notebook_id}")
async def delete_notebook(notebook_id: str):
    meta = _load_meta()
    if notebook_id not in meta:
        raise HTTPException(status_code=404, detail="Notebook not found")
    del meta[notebook_id]
    _save_meta(meta)

    delete_collection(notebook_id)
    remove_notebook_from_global_index(notebook_id)

    doc_meta = _load_doc_meta()
    removed_count = 0
    for doc_id, doc in list(doc_meta.items()):
        if doc.get("notebook_id") == notebook_id:
            if "filepath" in doc and os.path.exists(doc["filepath"]):
                os.remove(doc["filepath"])
            del doc_meta[doc_id]
            removed_count += 1
    _save_doc_meta(doc_meta)

    notes_file = os.path.join(NOTES_DIR, f"{notebook_id}.json")
    if os.path.exists(notes_file):
        os.remove(notes_file)

    conv_file = os.path.join(settings.data_dir, "conversations", f"{notebook_id}.json")
    if os.path.exists(conv_file):
        os.remove(conv_file)

    conv_meta_file = os.path.join(settings.data_dir, "conversations_meta", f"{notebook_id}.json")
    if os.path.exists(conv_meta_file):
        os.remove(conv_meta_file)

    return {"ok": True, "removed_documents": removed_count}


@router.get("/notebooks/{notebook_id}/export")
async def export_notebook(notebook_id: str):
    """Export an entire notebook as a downloadable ZIP package.

    The ZIP contains README.md, conversation.md, metadata.json, and all
    uploaded documents in a documents/ subfolder. Built entirely in memory
    without touching the disk.
    """
    meta = _load_meta()
    if notebook_id not in meta:
        raise HTTPException(status_code=404, detail="Notebook not found")

    nb = meta[notebook_id]
    notebook_name = nb.get("name", "Untitled")
    safe_name = notebook_name.replace(" ", "_")

    doc_meta = _load_doc_meta()
    nb_docs = {
        doc_id: doc
        for doc_id, doc in doc_meta.items()
        if doc.get("notebook_id") == notebook_id
    }

    conv_file = os.path.join(settings.data_dir, "conversations", f"{notebook_id}.json")
    conversations: list[dict] = []
    if os.path.exists(conv_file):
        with open(conv_file, "r", encoding="utf-8") as f:
            conversations = json.load(f)

    notes = _load_notes(notebook_id)
    now = _now()

    export_metadata = {
        "notebook_id": notebook_id,
        "name": notebook_name,
        "tags": nb.get("tags", []),
        "created_at": nb.get("created_at"),
        "updated_at": nb.get("updated_at"),
        "exported_at": now,
        "document_count": len(nb_docs),
        "conversation_message_count": len(conversations),
        "note_count": len(notes),
    }

    conv_md = _build_export_conversation_md(notebook_name, conversations)
    readme = _build_export_readme(notebook_name, export_metadata)

    buf = io.BytesIO()
    prefix = f"{safe_name}/"

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{prefix}README.md", readme)
        zf.writestr(f"{prefix}metadata.json", json.dumps(export_metadata, indent=2, ensure_ascii=False))
        zf.writestr(f"{prefix}conversation.md", conv_md)

        for doc_id, doc in nb_docs.items():
            filepath = doc.get("filepath", "")
            filename = doc.get("filename", doc_id)
            if filepath and os.path.exists(filepath):
                zf.write(filepath, f"{prefix}documents/{filename}")

    buf.seek(0)

    def iter_zip():
        while True:
            chunk = buf.read(8192)
            if not chunk:
                break
            yield chunk

    return StreamingResponse(
        iter_zip(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


@router.get("/tags")
async def list_tags():
    """Return deduplicated sorted list of all unique tags across all notebooks."""
    meta = _load_meta()
    all_tags = set()
    for nb_data in meta.values():
        for t in nb_data.get("tags", []):
            if t and t.strip():
                all_tags.add(t.strip())
    return sorted(all_tags)


@router.delete("/tags/{name}")
async def delete_tag(name: str):
    """Remove the specified tag from all notebooks."""
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")
    name = name.strip()
    meta = _load_meta()
    removed_from = 0
    for nb_id, nb_data in meta.items():
        tags = nb_data.get("tags", [])
        if name in tags:
            meta[nb_id]["tags"] = [t for t in tags if t != name]
            meta[nb_id]["updated_at"] = _now()
            removed_from += 1
    if removed_from > 0:
        _save_meta(meta)
    return {"ok": True, "removed_from": removed_from}


@router.get("/notes/{notebook_id}", response_model=list[NoteResponse])
async def list_notes(notebook_id: str):
    notes = _load_notes(notebook_id)
    return [NoteResponse(**n) for n in notes]


@router.post("/notes", response_model=NoteResponse)
async def create_note(body: NoteCreate):
    note_id = str(uuid.uuid4())
    now = _now()
    note_data = {
        "id": note_id,
        "notebook_id": body.notebook_id,
        "title": body.title or "Untitled",
        "content": body.content,
        "created_at": now,
        "updated_at": now,
    }
    notes = _load_notes(body.notebook_id)
    notes.insert(0, note_data)
    _save_notes(body.notebook_id, notes)
    return NoteResponse(**note_data)


@router.patch("/notes/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, body: NoteCreate):
    notebook_id = body.notebook_id
    notes = _load_notes(notebook_id)
    for i, n in enumerate(notes):
        if n["id"] == note_id:
            notes[i]["title"] = body.title or n.get("title", "Untitled")
            notes[i]["content"] = body.content
            notes[i]["updated_at"] = _now()
            _save_notes(notebook_id, notes)
            return NoteResponse(**notes[i])
    raise HTTPException(status_code=404, detail="Note not found")


@router.delete("/notes/{notebook_id}/{note_id}")
async def delete_note(notebook_id: str, note_id: str):
    notes = _load_notes(notebook_id)
    notes = [n for n in notes if n["id"] != note_id]
    _save_notes(notebook_id, notes)
    return {"ok": True}
