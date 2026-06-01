import re
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
)

from app.config import get_settings

settings = get_settings()

MD_HEADERS_TO_SPLIT_ON = [
    ("#", "h1"),
    ("##", "h2"),
    ("###", "h3"),
]


def chunk_text(text: str, file_type: str) -> list[dict]:
    if file_type == "markdown":
        return chunk_markdown(text)
    elif file_type == "code":
        return chunk_code(text)
    else:
        return chunk_default(text)


def chunk_default(text: str) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", "。", ".", " ", ""],
    )
    chunks = splitter.split_text(text)
    return [{"text": c, "metadata": {}} for c in chunks if c.strip()]


def chunk_markdown(text: str) -> list[dict]:
    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=MD_HEADERS_TO_SPLIT_ON,
        return_each_line=False,
    )
    try:
        md_docs = md_splitter.split_text(text)
    except Exception:
        return chunk_default(text)

    chunks = []
    for doc in md_docs:
        inner_chunks = chunk_default(doc.page_content)
        base_meta = doc.metadata
        for ic in inner_chunks:
            meta = {**base_meta, **ic["metadata"]}
            heading_ctx = " | ".join(
                filter(None, [meta.get("h1"), meta.get("h2"), meta.get("h3")])
            )
            if heading_ctx:
                ic["text"] = f"[{heading_ctx}]\n{ic['text']}"
            ic["metadata"] = meta
            chunks.append(ic)
    return chunks


def chunk_code(text: str) -> list[dict]:
    functions = _split_by_functions(text)
    if not functions or len(functions) == 1:
        return chunk_default(text)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )

    chunks = []
    for func_text in functions:
        func_chunks = splitter.split_text(func_text)
        for c in func_chunks:
            if c.strip():
                chunks.append({"text": c, "metadata": {"file_type": "code"}})
    return chunks


def _split_by_functions(text: str) -> list[str]:
    patterns = [
        (r'(def\s+\w+\s*\(.*?\)\s*(?:->.*?)?\s*:)', 'python'),
        (r'(function\s+\w+\s*\(.*?\)\s*\{)', 'javascript'),
        (r'((?:export\s+)?(?:async\s+)?function\s+\w+\s*\(.*?\)\s*\{)', 'typescript'),
        (r'(const\s+\w+\s*=\s*(?:async\s*)?\(.*?\)\s*=>\s*\{)', 'arrow'),
        (r'(class\s+\w+)', 'class'),
    ]
    for pattern, _ in patterns:
        matches = list(re.finditer(pattern, text, re.MULTILINE))
        if len(matches) >= 2:
            parts = []
            for i, m in enumerate(matches):
                start = m.start()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                parts.append(text[start:end])
            if parts:
                before_first = text[:matches[0].start()].strip()
                if before_first:
                    parts.insert(0, before_first)
                return parts
    return [text]
