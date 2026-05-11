from typing import Optional
from openai import OpenAI

from app.config import get_settings


def get_embed_client() -> Optional[OpenAI]:
    settings = get_settings()
    base_url = settings.embed_base_url_resolved
    api_key = settings.embed_api_key_resolved
    if not base_url or not api_key:
        return None
    return OpenAI(base_url=base_url, api_key=api_key)


def embed_texts(texts: list[str]) -> Optional[list[list[float]]]:
    client = get_embed_client()
    settings = get_settings()

    if client is None:
        return fallback_embed_local(texts)

    model = settings.embed_model
    try:
        resp = client.embeddings.create(input=texts, model=model)
        return [d.embedding for d in resp.data]
    except Exception:
        return fallback_embed_local(texts)


def embed_query(text: str) -> Optional[list[float]]:
    result = embed_texts([text])
    if result:
        return result[0]
    return None


def fallback_embed_local(texts: list[str]) -> list[list[float]]:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()
