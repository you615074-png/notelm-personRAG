import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o")

    embed_base_url: str = os.getenv("EMBED_BASE_URL", "")
    embed_api_key: str = os.getenv("EMBED_API_KEY", "")
    embed_model: str = os.getenv("EMBED_MODEL", "text-embedding-3-small")

    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    data_dir: str = os.getenv("DATA_DIR", "../data")
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "1000"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "5"))

    @property
    def embed_base_url_resolved(self) -> str:
        return self.embed_base_url or self.llm_base_url

    @property
    def embed_api_key_resolved(self) -> str:
        return self.embed_api_key or self.llm_api_key

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


@lru_cache()
def get_settings() -> Settings:
    return Settings()
