import os
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import DocumentResponse, WebFetchRequest
from app.services.parser import parse_file, save_upload, fetch_url_content, detect_file_type
from app.services.chunker import chunk_text
from app.services.embedder import embed_texts
from app.database import add_chunks, delete_document_chunks, get_document_chunks_count
from app.config import get_settings

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()

META_FILE = os.path.join(settings.data_dir, "documents_meta.json")


def _load_meta() -> dict:
    if not os.path.exists(META_FILE):
        return {}
    with open(META_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_meta(meta: dict):
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


@router.get("/notebook/{notebook_id}", response_model=list[DocumentResponse])
async def list_documents(notebook_id: str):
    meta = _load_meta()
    docs = []
    for doc_id, doc in meta.items():
        if doc.get("notebook_id") == notebook_id:
            docs.append(
                DocumentResponse(
                    id=doc_id,
                    notebook_id=notebook_id,
                    filename=doc["filename"],
                    file_type=doc["file_type"],
                    chunk_count=get_document_chunks_count(notebook_id, doc_id),
                    created_at=doc["created_at"],
                )
            )
    docs.sort(key=lambda x: x.created_at, reverse=True)
    return docs


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(notebook_id: str, file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_type = detect_file_type(file.filename)
    if file_type is None:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.filename}")

    if file.filename:
        meta = _load_meta()
        for doc_id, doc in meta.items():
            if doc.get("notebook_id") == notebook_id and doc.get("filename") == file.filename:
                raise HTTPException(status_code=409, detail=f"Document '{file.filename}' already exists in this notebook")

    filepath = await save_upload(file)
    text = await parse_file(filepath, file.filename)
    chunks = chunk_text(text, file_type)

    if not chunks:
        raise HTTPException(status_code=400, detail="No extractable text found in document")

    chunk_texts = [c["text"] for c in chunks]
    embeddings = embed_texts(chunk_texts)
    if embeddings is None:
        raise HTTPException(status_code=500, detail="Embedding service unavailable")

    for i, c in enumerate(chunks):
        c["embedding"] = embeddings[i]
        c["metadata"]["filename"] = file.filename
        c["metadata"]["source"] = file.filename

    doc_id = str(uuid.uuid4())
    for c in chunks:
        c["metadata"]["doc_id"] = doc_id
        c["metadata"]["source_id"] = doc_id

    add_chunks(notebook_id, chunks)

    meta = _load_meta()
    meta[doc_id] = {
        "notebook_id": notebook_id,
        "filename": file.filename,
        "file_type": file_type,
        "filepath": filepath,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_meta(meta)

    return DocumentResponse(
        id=doc_id,
        notebook_id=notebook_id,
        filename=file.filename,
        file_type=file_type,
        chunk_count=len(chunks),
        created_at=meta[doc_id]["created_at"],
    )


@router.post("/fetch-url", response_model=DocumentResponse)
async def fetch_url(body: WebFetchRequest):
    meta = _load_meta()
    for doc_id, doc in meta.items():
        if doc.get("notebook_id") == body.notebook_id and doc.get("url") == body.url:
            raise HTTPException(status_code=409, detail="This URL has already been fetched in this notebook")

    result = await fetch_url_content(body.url)
    filepath = result["filepath"]
    title = result["title"]

    text = await parse_file(filepath, filepath)
    chunks = chunk_text(text, "html")

    if not chunks:
        raise HTTPException(status_code=400, detail="No extractable content from URL")

    chunk_texts = [c["text"] for c in chunks]
    embeddings = embed_texts(chunk_texts)
    if embeddings is None:
        raise HTTPException(status_code=500, detail="Embedding service unavailable")

    for i, c in enumerate(chunks):
        c["embedding"] = embeddings[i]
        c["metadata"]["source"] = body.url
        c["metadata"]["url"] = body.url
        c["metadata"]["filename"] = title

    doc_id = str(uuid.uuid4())
    for c in chunks:
        c["metadata"]["doc_id"] = doc_id
        c["metadata"]["source_id"] = doc_id

    add_chunks(body.notebook_id, chunks)

    meta = _load_meta()
    meta[doc_id] = {
        "notebook_id": body.notebook_id,
        "filename": title,
        "file_type": "url",
        "url": body.url,
        "filepath": result["filepath"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_meta(meta)

    return DocumentResponse(
        id=doc_id,
        notebook_id=body.notebook_id,
        filename=title,
        file_type="url",
        chunk_count=len(chunks),
        created_at=meta[doc_id]["created_at"],
    )


@router.delete("/{notebook_id}/{doc_id}")
async def delete_document(notebook_id: str, doc_id: str):
    delete_document_chunks(notebook_id, doc_id)
    meta = _load_meta()
    if doc_id in meta:
        if "filepath" in meta[doc_id] and os.path.exists(meta[doc_id]["filepath"]):
            os.remove(meta[doc_id]["filepath"])
        del meta[doc_id]
        _save_meta(meta)
    return {"ok": True}


@router.get("/{notebook_id}/{doc_id}/content")
async def get_document_content(notebook_id: str, doc_id: str):
    meta = _load_meta()
    if doc_id not in meta:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = meta[doc_id]
    filepath = doc.get("filepath", "")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Document file not found")
    try:
        text = await parse_file(filepath, doc.get("filename", filepath))
        return {"content": text[:10000]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read document: {str(e)}")
