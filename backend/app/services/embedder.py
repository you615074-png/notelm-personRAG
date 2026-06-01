import logging
from typing import Optional
from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

_sentence_transformer_model = None


def _get_local_model():
    global _sentence_transformer_model
    if _sentence_transformer_model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading local embedding model: all-MiniLM-L6-v2 ...")
        _sentence_transformer_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Local embedding model loaded successfully")
    return _sentence_transformer_model


def get_embed_client() -> Optional[OpenAI]:
    settings = get_settings()
    base_url = settings.embed_base_url_resolved
    api_key = settings.embed_api_key_resolved
    if not base_url or not api_key:
        return None
    return OpenAI(base_url=base_url, api_key=api_key)


def embed_texts(texts: list[str]) -> Optional[list[list[float]]]:
    if not texts:
        return []
    client = get_embed_client()
    settings = get_settings()

    if client is None:
        return fallback_embed_local(texts)

    model = settings.embed_model
    try:
        resp = client.embeddings.create(input=texts, model=model)
        return [d.embedding for d in resp.data]
    except Exception as e:
        logger.warning(f"API embedding failed ({e}), falling back to local model")
        return fallback_embed_local(texts)


def embed_query(text: str) -> Optional[list[float]]:
    result = embed_texts([text])
    if result:
        return result[0]
    return None


def test_embedding_connection() -> dict:
    client = get_embed_client()
    if client is None:
        return {
            "ok": True,
            "mode": "local",
            "model": "all-MiniLM-L6-v2",
            "message": "Using local embedding model (all-MiniLM-L6-v2)"
        }
    settings = get_settings()
    try:
        resp = client.embeddings.create(input=["test connection"], model=settings.embed_model)
        dim = len(resp.data[0].embedding) if resp.data else 0
        return {
            "ok": True,
            "mode": "api",
            "model": settings.embed_model,
            "dimensions": dim,
            "message": f"Connected to {settings.embed_base_url_resolved}"
        }
    except Exception as e:
        return {
            "ok": False,
            "mode": "api",
            "model": settings.embed_model,
            "error": str(e),
            "message": f"API embedding failed, will use local fallback"
        }


def test_llm_connection() -> dict:
    from openai import OpenAI
    settings = get_settings()
    try:
        client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
        resp = client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": "Reply with just: OK"}],
            max_tokens=5,
            temperature=0,
        )
        return {
            "ok": True,
            "model": settings.llm_model,
            "message": f"Connected to {settings.llm_base_url}, model: {settings.llm_model}"
        }
    except Exception as e:
        return {
            "ok": False,
            "model": settings.llm_model,
            "error": str(e),
            "message": "LLM connection failed"
        }


def fallback_embed_local(texts: list[str]) -> list[list[float]]:
    model = _get_local_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()
