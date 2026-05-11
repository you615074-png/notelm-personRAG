import os
import uuid
from dataclasses import dataclass, field, asdict
from typing import Optional

os.environ["TOKENIZERS_PARALLELISM"] = "false"  # suppress huggingface warning

import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import get_settings

settings = get_settings()

_chroma_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_or_create_collection(notebook_id: str) -> chromadb.Collection:
    client = get_chroma_client()
    col_name = f"notebook_{notebook_id}"
    return client.get_or_create_collection(
        name=col_name,
        metadata={"hnsw:space": "cosine"},
    )


def delete_collection(notebook_id: str):
    client = get_chroma_client()
    col_name = f"notebook_{notebook_id}"
    try:
        client.delete_collection(col_name)
    except Exception:
        pass


def add_chunks(notebook_id: str, chunks: list[dict]):
    col = get_or_create_collection(notebook_id)
    if not chunks:
        return
    ids = [str(uuid.uuid4()) for _ in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]
    embeddings = [c["embedding"] for c in chunks]
    col.add(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)


def query_chunks(
    notebook_id: str,
    query_embedding: list[float],
    top_k: int = 5,
) -> list[dict]:
    col = get_or_create_collection(notebook_id)
    if col.count() == 0:
        return []
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, col.count()),
        include=["documents", "metadatas", "distances"],
    )
    items = []
    if results["ids"] and results["ids"][0]:
        for i in range(len(results["ids"][0])):
            items.append(
                {
                    "id": results["ids"][0][i],
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": 1.0 - results["distances"][0][i],
                }
            )
    return items


def get_document_chunks_count(notebook_id: str, doc_id: str) -> int:
    col = get_or_create_collection(notebook_id)
    try:
        result = col.get(where={"source_id": doc_id})
        return len(result["ids"]) if result["ids"] else 0
    except Exception:
        return 0


def delete_document_chunks(notebook_id: str, doc_id: str):
    col = get_or_create_collection(notebook_id)
    try:
        results = col.get(where={"source_id": doc_id})
        if results["ids"]:
            col.delete(ids=results["ids"])
    except Exception:
        pass


def list_notebook_collections() -> list[str]:
    client = get_chroma_client()
    cols = client.list_collections()
    notebook_ids = []
    for c in cols:
        if c.name.startswith("notebook_"):
            notebook_ids.append(c.name[len("notebook_"):])
    return notebook_ids
