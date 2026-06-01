import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        self.llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        self.llm_api_key: str = os.getenv("LLM_API_KEY", "")
        self.llm_model: str = os.getenv("LLM_MODEL", "gpt-4o")

        self.embed_base_url: str = os.getenv("EMBED_BASE_URL", "")
        self.embed_api_key: str = os.getenv("EMBED_API_KEY", "")
        self.embed_model: str = os.getenv("EMBED_MODEL", "text-embedding-3-small")

        self.host: str = os.getenv("HOST", "0.0.0.0")
        self.port: int = int(os.getenv("PORT", "8000") or "8000")

        self.data_dir: str = os.getenv("DATA_DIR", "../data")
        self.chunk_size: int = int(os.getenv("CHUNK_SIZE", "1000") or "1000")
        self.chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "200") or "200")
        self.retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "5") or "5")
        self.hyde_enabled: bool = os.getenv("HYDE_ENABLED", "true").lower() != "false"

    @property
    def embed_base_url_resolved(self) -> str:
        return (self.embed_base_url or "").strip() or self.llm_base_url

    @property
    def embed_api_key_resolved(self) -> str:
        return (self.embed_api_key or "").strip() or self.llm_api_key

    @property
    def chroma_dir(self) -> str:
        path = os.path.join(self.data_dir, "chroma")
        os.makedirs(path, exist_ok=True)
        return path

    @property
    def uploads_dir(self) -> str:
        path = os.path.join(self.data_dir, "uploads")
        os.makedirs(path, exist_ok=True)
        return path

    @property
    def notes_dir(self) -> str:
        path = os.path.join(self.data_dir, "notes")
        os.makedirs(path, exist_ok=True)
        return path

    @property
    def is_llm_configured(self) -> bool:
        return bool(self.llm_base_url.strip()) and bool(self.llm_api_key.strip())


@lru_cache()
def get_settings() -> Settings:
    return Settings()
