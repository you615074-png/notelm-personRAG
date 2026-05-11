#!/usr/bin/env python3
"""Build a distributable version of Notelm without source code.

Usage:
    py build-dist.py          # Build the dist package
    py build-dist.py --zip    # Build and create a zip archive

Output: dist/notelm/  (ready-to-share folder)
"""
import os
import sys
import shutil
import tokenize
import io
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist" / "notelm"
FRONTEND_SRC = ROOT / "frontend"
BACKEND_SRC = ROOT / "backend"
FRONTEND_OUT = DIST / "frontend_static"
BACKEND_OUT = DIST / "backend"


def step(msg):
    print(f"\n[STEP] {msg}")


def cmd(args, cwd=None, env=None):
    print(f"  RUN: {' '.join(args)}")
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    subprocess.run(args, cwd=cwd, check=True, env=merged_env)


def clean_dist():
    step("Cleaning dist/")
    if DIST.parent.exists():
        shutil.rmtree(DIST.parent, ignore_errors=True)
    DIST.parent.mkdir(parents=True, exist_ok=True)


def build_frontend():
    step("Building frontend static export")
    cmd(["cmd", "/c", "npm install"], cwd=str(FRONTEND_SRC))
    
    env_extra = {"DIST_BUILD": "1"}
    cmd(["cmd", "/c", "npx next build"], cwd=str(FRONTEND_SRC), env=env_extra)

    out_dir = FRONTEND_SRC / "out"
    if not out_dir.exists():
        print("  ERROR: frontend build failed, out/ not found")
        sys.exit(1)

    step("Copying frontend static files")
    if FRONTEND_OUT.exists():
        shutil.rmtree(FRONTEND_OUT)
    shutil.copytree(out_dir, FRONTEND_OUT)
    
    # Remove any stray .map or source files if present
    for f in FRONTEND_OUT.rglob("*.map"):
        f.unlink()
    for f in FRONTEND_OUT.rglob("*.txt"):
        if f.name != "robots.txt":
            f.unlink()
    
    print(f"  Frontend static files: {FRONTEND_OUT}")


def minify_source(filepath: Path):
    """Strip comments and docstrings from a Python file."""
    try:
        source = filepath.read_text(encoding="utf-8")
    except Exception:
        return

    result = []
    prev_tok_type = tokenize.NEWLINE
    last_line = -1

    g = tokenize.generate_tokens(io.StringIO(source).readline)
    for tok_type, tok_string, start, end, _ in g:
        if tok_type == tokenize.COMMENT:
            continue
        if tok_type == tokenize.STRING and prev_tok_type in (
            tokenize.NEWLINE,
            tokenize.INDENT,
            tokenize.DEDENT,
            tokenize.ENDMARKER,
        ):
            continue
        sline, scol = start
        eline, ecol = end
        if sline > last_line:
            last_line = sline
        result.append((tok_type, tok_string, start, end))
        prev_tok_type = tok_type

    lines = []
    current_line = 1
    current_col = 0
    for tok_type, tok_string, start, end in result:
        sline, scol = start

        if tok_type == tokenize.ENDMARKER:
            break

        if tok_type in (tokenize.NEWLINE, tokenize.NL):
            lines.append("\n")
            current_line = sline + 1
            current_col = 0
            continue

        if tok_type == tokenize.DEDENT:
            current_line = sline + 1
            current_col = 0
            continue

        while current_line < sline:
            lines.append("\n")
            current_line += 1
            current_col = 0

        if scol > current_col:
            lines.append(" " * (scol - current_col))
        lines.append(tok_string)
        current_col = scol + len(tok_string)
        current_line = sline

    filepath.write_text("".join(lines).rstrip("\n") + "\n", encoding="utf-8")


def compile_backend():
    step("Minifying Python backend source")

    app_dir = BACKEND_SRC / "app"
    app_out = BACKEND_OUT / "app"

    if app_out.exists():
        shutil.rmtree(app_out)
    shutil.copytree(app_dir, app_out, ignore=shutil.ignore_patterns('__pycache__'))

    for pycache in app_out.rglob("__pycache__"):
        shutil.rmtree(pycache, ignore_errors=True)

    minified = 0
    for py_file in app_out.rglob("*.py"):
        minify_source(py_file)
        minified += 1
    print(f"  Minified {minified} Python files")

    shutil.copy2(BACKEND_SRC / "requirements.txt", BACKEND_OUT / "requirements.txt")
    env_example = BACKEND_SRC / ".env.example"
    if env_example.exists():
        content = env_example.read_text(encoding="utf-8")
        (BACKEND_OUT / ".env").write_text(content, encoding="utf-8")

    print(f"  Backend ready at: {BACKEND_OUT}")


def copy_data():
    step("Creating data directory")
    data_dir = DIST / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "chroma").mkdir(exist_ok=True)
    (data_dir / "uploads").mkdir(exist_ok=True)
    (data_dir / "notes").mkdir(exist_ok=True)


def create_scripts():
    step("Creating setup/start scripts")
    
    setup_bat = DIST / "setup.bat"
    setup_bat.write_text(
        "@echo off\r\n"
        "echo ============================================\r\n"
        "echo  Notelm - Installing dependencies\r\n"
        "echo ============================================\r\n"
        "echo.\r\n"
        "cd /d %~dp0backend\r\n"
        "py -m pip install -r requirements.txt --quiet\r\n"
        "echo.\r\n"
        "echo Done! Run start.bat to launch.\r\n"
        "pause\r\n",
        encoding="utf-8",
    )
    
    start_bat = DIST / "start.bat"
    start_bat.write_text(
        "@echo off\r\n"
        "echo ============================================\r\n"
        "echo  Notelm\r\n"
        "echo ============================================\r\n"
        "echo.\r\n"
        "cd /d %~dp0backend\r\n"
        'py -m uvicorn app.main:app --host 0.0.0.0 --port 8000\r\n'
        "echo.\r\n"
        "pause\r\n",
        encoding="utf-8",
    )
    
    readme = DIST / "README.md"
    readme.write_text(
        "# Notelm - Personal RAG Research Notebook\r\n\r\n"
        "A local RAG (Retrieval-Augmented Generation) notebook app. "
        "Upload documents, ask questions, get AI answers with source citations "
        "- all running on your machine.\r\n\r\n"
        "## Requirements\r\n\r\n"
        "- Python 3.10+ with pip\r\n"
        "- An OpenAI-compatible API key (OpenAI, DeepSeek, Ollama, etc.)\r\n"
        "- No Node.js required\r\n\r\n"
        "## Quick Start\r\n\r\n"
        "1. Run `setup.bat` to install Python dependencies (first time only)\r\n"
        "2. Edit `backend\\.env` to configure your LLM API (see below)\r\n"
        "3. Run `start.bat` to launch the server\r\n"
        "4. Open http://localhost:8000 in your browser\r\n\r\n"
        "## API Configuration\r\n\r\n"
        "Edit `backend\\.env` with your API details:\r\n\r\n"
        "### OpenAI\r\n"
        "```env\r\n"
        "LLM_BASE_URL=https://api.openai.com/v1\r\n"
        "LLM_API_KEY=sk-your-key-here\r\n"
        "LLM_MODEL=gpt-4o\r\n"
        "EMBED_MODEL=text-embedding-3-small\r\n"
        "```\r\n\r\n"
        "### DeepSeek\r\n"
        "```env\r\n"
        "LLM_BASE_URL=https://api.deepseek.com/v1\r\n"
        "LLM_API_KEY=sk-your-key-here\r\n"
        "LLM_MODEL=deepseek-chat\r\n"
        "# EMBED_MODEL not needed - uses local fallback\r\n"
        "```\r\n\r\n"
        "### Ollama (local, free)\r\n"
        "```env\r\n"
        "LLM_BASE_URL=http://localhost:11434/v1\r\n"
        "LLM_API_KEY=ollama\r\n"
        "LLM_MODEL=qwen2.5:7b\r\n"
        "EMBED_MODEL=nomic-embed-text\r\n"
        "```\r\n\r\n"
        "You can also configure API settings from the browser UI (Settings button).\r\n\r\n"
        "## Supported Document Types\r\n\r\n"
        "PDF, DOCX, PPTX, TXT, Markdown, CSV, Code files, Web URLs (HTML)\r\n\r\n"
        "## Data Storage\r\n\r\n"
        "All data stays local under `data/`:\r\n"
        "- `data/chroma/` - Vector database\r\n"
        "- `data/uploads/` - Uploaded files\r\n"
        "- `data/notes/` - Saved notes\r\n"
        "- `data/notebooks_meta.json` - Notebook config\r\n\r\n"
        "## Troubleshooting\r\n\r\n"
        "**Startup errors:** Make sure you ran `setup.bat` first and Python 3.10+ is on PATH.\r\n\r\n"
        "**No sources found:** Your question may be outside document scope. "
        "Notebook only answers from uploaded documents.\r\n\r\n"
        "**Embedding fallback:** If no EMBED_MODEL is configured, the app auto-downloads "
        "`all-MiniLM-L6-v2` (~80MB) on first use.\r\n",
        encoding="utf-8",
    )


def create_zip():
    step("Creating zip archive")
    import zipfile
    zip_path = ROOT / "dist" / "notelm-dist.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(DIST):
            dirs[:] = [d for d in dirs if d != "__pycache__"]
            for file in files:
                full = os.path.join(root, file)
                arcname = os.path.relpath(full, DIST.parent)
                zf.write(full, arcname)
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"  Created: {zip_path} ({size_mb:.1f} MB)")


def main():
    os.chdir(str(ROOT))
    
    clean_dist()
    build_frontend()
    compile_backend()
    copy_data()
    create_scripts()
    
    step("Build complete!")
    print(f"\n  Distribution folder: {DIST}")
    print(f"  To share: send the entire dist/notelm/ folder")
    print(f"  Recipient: runs setup.bat then start.bat")
    
    if "--zip" in sys.argv:
        create_zip()


if __name__ == "__main__":
    main()
