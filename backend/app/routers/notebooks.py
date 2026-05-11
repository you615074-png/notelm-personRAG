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

router = APIRouter(prefix="/api/notebooks", tags=["notebooks"])

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


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("", response_model=list[NotebookResponse])
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


@router.post("", response_model=NotebookResponse)
async def create_notebook(body: NotebookCreate):
    nb_id = str(uuid.uuid4())
    now = _now()
    meta = _load_meta()
    meta[nb_id] = {"name": body.name, "created_at": now, "updated_at": now}
    _save_meta(meta)
    return NotebookResponse(id=nb_id, name=body.name, created_at=now, updated_at=now)


@router.get("/{notebook_id}", response_model=NotebookResponse)
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


@router.patch("/{notebook_id}", response_model=NotebookResponse)
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


@router.delete("/{notebook_id}")
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

    notes_pattern = os.path.join(NOTES_DIR, f"{notebook_id}*.json")
    for note_file in glob.glob(notes_pattern):
        os.remove(note_file)

    return {"ok": True, "removed_documents": removed_count}
