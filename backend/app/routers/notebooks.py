import os
import json
import uuid
import glob
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    NotebookCreate,
    NotebookUpdate,
    NotebookResponse,
    NoteCreate,
    NoteResponse,
)
from app.config import get_settings
from app.database import delete_collection

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


@router.get("/notebooks", response_model=list[NotebookResponse])
async def list_notebooks():
    meta = _load_meta()
    notebooks = []
    for nb_id, nb_data in meta.items():
        notebooks.append(
            NotebookResponse(
                id=nb_id,
                name=nb_data["name"],
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
    meta[nb_id] = {"name": body.name, "created_at": now, "updated_at": now}
    _save_meta(meta)
    return NotebookResponse(id=nb_id, name=body.name, created_at=now, updated_at=now)


@router.get("/notebooks/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(notebook_id: str):
    meta = _load_meta()
    if notebook_id not in meta:
        raise HTTPException(status_code=404, detail="Notebook not found")
    nb = meta[notebook_id]
    return NotebookResponse(
        id=notebook_id,
        name=nb["name"],
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
    meta[notebook_id]["updated_at"] = _now()
    _save_meta(meta)
    nb = meta[notebook_id]
    return NotebookResponse(
        id=notebook_id,
        name=nb["name"],
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

    return {"ok": True, "removed_documents": removed_count}


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
