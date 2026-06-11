import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.routers import notebooks, documents, chat, search, summaries
from app.config import get_settings
from app.database import rebuild_global_index

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Notelm API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    logger.info("Running global search index migration…")
    try:
        rebuild_global_index()
        logger.info("Global search index migration complete")
    except Exception as e:
        logger.error(f"Global search index migration failed: {e}")


app.include_router(notebooks.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(summaries.router)


@app.get("/api/health")
async def health():
    from app.services.embedder import test_embedding_connection, test_llm_connection
    embed_status = test_embedding_connection()
    llm_status = test_llm_connection()
    return {
        "status": "ok",
        "version": "1.0.0",
        "embedding": embed_status,
        "llm": llm_status,
    }


@app.get("/api/health/simple")
async def health_simple():
    return {"status": "ok"}


settings = get_settings()
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend_static")
FRONTEND_EXISTS = os.path.isdir(FRONTEND_DIR)

if FRONTEND_EXISTS:
    app.mount("/_next", StaticFiles(directory=os.path.join(FRONTEND_DIR, "_next")), name="next_static")

    @app.get("/notebook/{rest:path}")
    async def notebook_spa():
        path = os.path.join(FRONTEND_DIR, "notebook", "_placeholder", "index.html")
        if os.path.exists(path):
            return FileResponse(path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/{rest:path}")
    async def spa_fallback(rest: str):
        file_path = os.path.join(FRONTEND_DIR, rest)
        if rest and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/")
    async def root():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
