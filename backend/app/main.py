import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.routers import notebooks, documents, chat
from app.config import get_settings

app = FastAPI(title="Notelm API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notebooks.router)
app.include_router(documents.router)
app.include_router(chat.router)


@app.get("/api/health")
async def health():
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
