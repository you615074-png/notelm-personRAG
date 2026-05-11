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
            ic["metadata"] = {**base_meta, **ic["metadata"]}
            chunks.append(ic)
    return chunks


def chunk_code(text: str) -> list[dict]:
    return chunk_default(text)
