from fastapi import APIRouter, Query
from app.database import query_global
from app.services.embedder import embed_query
from app.models.schemas import SearchResult

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=list[SearchResult])
async def global_search(q: str = Query(default="", description="Search query")):
    """Search across all notebooks using the global ChromaDB index."""
    if not q.strip():
        return []

    query_embedding = embed_query(q)
    if query_embedding is None:
        return []

    results = query_global(query_embedding, top_k=10)

    seen: set[str] = set()
    search_results: list[SearchResult] = []
    for r in results:
        snippet = r["text"]
        # Deduplicate by chunk content
        if snippet in seen:
            continue
        seen.add(snippet)

        meta = r["metadata"]
        search_results.append(
            SearchResult(
                snippet=snippet,
                source=meta.get("source", meta.get("filename", "Unknown")),
                notebook_id=meta.get("notebook_id", ""),
                notebook_name=meta.get("notebook_name", "Unknown"),
            )
        )

    return search_results
