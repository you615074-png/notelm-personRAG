import os
import re
import uuid
import aiofiles
from typing import Optional
from fastapi import UploadFile

from app.config import get_settings

settings = get_settings()

SUPPORTED_EXTENSIONS = {
    ".pdf": "pdf",
    ".txt": "txt",
    ".md": "markdown",
    ".mdx": "markdown",
    ".docx": "docx",
    ".pptx": "pptx",
    ".py": "code",
    ".js": "code",
    ".ts": "code",
    ".tsx": "code",
    ".jsx": "code",
    ".json": "code",
    ".yaml": "code",
    ".yml": "code",
    ".html": "html",
    ".css": "code",
    ".csv": "csv",
}


def detect_file_type(filename: str) -> Optional[str]:
    ext = os.path.splitext(filename)[1].lower()
    return SUPPORTED_EXTENSIONS.get(ext)


async def save_upload(file: UploadFile) -> str:
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "untitled")[1]
    save_path = os.path.join(settings.uploads_dir, f"{file_id}{ext}")
    os.makedirs(settings.uploads_dir, exist_ok=True)
    async with aiofiles.open(save_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)
    return save_path


async def parse_file(filepath: str, filename: str) -> str:
    file_type = detect_file_type(filename)
    if file_type is None:
        raise ValueError(f"Unsupported file type: {filename}")

    if file_type == "pdf":
        return parse_pdf(filepath)
    elif file_type == "docx":
        return parse_docx(filepath)
    elif file_type == "pptx":
        return parse_pptx(filepath)
    elif file_type == "html":
        return parse_html(filepath)
    elif file_type == "csv":
        return parse_csv(filepath)
    elif file_type in ("txt", "markdown", "code", "json", "yaml"):
        return parse_text(filepath)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def parse_pdf(filepath: str) -> str:
    import fitz
    doc = fitz.open(filepath)
    pages = []
    total_text = ""
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(f"[Page {page.number + 1}]\n{text.strip()}")
            total_text += text.strip()
    doc.close()
    if not total_text:
        raise ValueError(
            "This PDF appears to be a scanned document (image-based) with no embedded text layer. "
            "Please use an OCR tool (e.g., Adobe Acrobat, Tesseract) to convert it to a searchable PDF first."
        )
    return "\n\n".join(pages)


def parse_docx(filepath: str) -> str:
    from docx import Document
    doc = Document(filepath)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text for cell in row.cells)
            if row_text.strip():
                paragraphs.append(row_text)
    return "\n".join(paragraphs)


def parse_pptx(filepath: str) -> str:
    from pptx import Presentation
    prs = Presentation(filepath)
    slides = []
    for idx, slide in enumerate(prs.slides, 1):
        texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    t = para.text.strip()
                    if t:
                        texts.append(t)
            if shape.has_table:
                for row in shape.table.rows:
                    row_text = " | ".join(cell.text for cell in row.cells)
                    if row_text.strip():
                        texts.append(row_text)
        if texts:
            slides.append(f"[Slide {idx}]\n" + "\n".join(texts))
    return "\n\n".join(slides)


def parse_html(filepath: str) -> str:
    from bs4 import BeautifulSoup
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        soup = BeautifulSoup(f.read(), "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text("\n", strip=True)


def parse_csv(filepath: str) -> str:
    import csv
    rows = []
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            return ""
        rows.append(" | ".join(headers))
        rows.append(" | ".join(["---"] * len(headers)))
        for i, row in enumerate(reader):
            if i >= 5000:
                rows.append(f"\n[Note: CSV truncated after 5000 rows, {i - 5000} remaining rows omitted]")
                break
            rows.append(" | ".join(row))
    return "\n".join(rows)


def parse_text(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


async def fetch_url_content(url: str) -> dict:
    import requests
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()

    content_type = resp.headers.get("content-type", "").lower()
    if "application/pdf" in content_type:
        file_id = str(uuid.uuid4())
        filepath = os.path.join(settings.uploads_dir, f"{file_id}.pdf")
        with open(filepath, "wb") as f:
            f.write(resp.content)
        return {"filepath": filepath, "title": url.rsplit("/", 1)[-1] or "webpage", "is_temporary": True}

    soup = BeautifulSoup(resp.text, "lxml")
    title = soup.title.string if soup.title else url
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)

    file_id = str(uuid.uuid4())
    filepath = os.path.join(settings.uploads_dir, f"{file_id}.html")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"<!-- URL: {url} -->\n<h1>{title}</h1>\n{text}")

    return {"filepath": filepath, "title": title, "is_temporary": True, "url": url}
