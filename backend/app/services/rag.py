import re
from openai import OpenAI

from app.config import get_settings
from app.database import query_chunks
from app.services.embedder import embed_query


async def generate_answer(
    notebook_id: str,
    question: str,
    top_k: int | None = None,
) -> dict:
    settings = get_settings()
    top_k = top_k or settings.retrieval_top_k

    q_embedding = embed_query(question)
    if q_embedding is None:
        return {"answer": "Error: Embedding service unavailable.", "citations": []}

    results = query_chunks(notebook_id, q_embedding, top_k=top_k)

    if not results:
        return {
            "answer": "当前笔记本中未找到相关文档。请先上传一些源文件。",
            "citations": [],
        }

    context_parts = []
    citations = []
    for i, item in enumerate(results, 1):
        meta = item["metadata"]
        source = meta.get("source", meta.get("filename", "unknown"))
        page = meta.get("page")
        context_parts.append(f"[{i}] Source: {source}" +
                             (f" (Page {page})" if page else "") +
                             f"\n{item['text']}")
        citations.append({
            "index": i,
            "source": source,
            "page": page,
            "snippet": item["text"][:300],
        })

    context = "\n\n".join(context_parts)

    system_prompt = (
        "你是一个严格基于用户文档的研究助手。你必须严格遵守以下规则：\n"
        "1. 只能根据下方【文档内容】中提供的信息来回答问题。\n"
        "2. 回答中使用 [1]、[2] 等编号标注信息来源。\n"
        "3. 如果文档内容不足以回答用户的问题，你必须明确回复："
        "\"⚠️ 该问题涉及的内容在您上传的文档中未找到相关依据。\"\n"
        "4. 严禁编造、推测或使用文档中不存在的信息。\n"
        "5. 即使用户反复追问，也不得脱离文档内容作答。\n"
        f"\n### 文档内容 ###\n{context}"
    )

    client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

    try:
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            temperature=0.3,
            max_tokens=2048,
        )
        answer = response.choices[0].message.content
    except Exception as e:
        return {"answer": f"LLM API error: {str(e)}", "citations": citations}

    return {"answer": answer, "citations": citations}


async def generate_answer_stream(
    notebook_id: str,
    question: str,
    top_k: int | None = None,
):
    settings = get_settings()
    top_k = top_k or settings.retrieval_top_k

    q_embedding = embed_query(question)
    if q_embedding is None:
        yield "Error: Embedding service unavailable."
        return

    results = query_chunks(notebook_id, q_embedding, top_k=top_k)

    if not results:
        yield "当前笔记本中未找到相关文档。请先上传一些源文件。"
        return

    context_parts = []
    citations_data = []
    for i, item in enumerate(results, 1):
        meta = item["metadata"]
        source = meta.get("source", meta.get("filename", "unknown"))
        page = meta.get("page")
        context_parts.append(f"[{i}] Source: {source}" +
                             (f" (Page {page})" if page else "") +
                             f"\n{item['text']}")
        citations_data.append({
            "index": i,
            "source": source,
            "page": page,
            "snippet": item["text"][:300],
        })

    context = "\n\n".join(context_parts)

    system_prompt = (
        "你是一个严格基于用户文档的研究助手。你必须严格遵守以下规则：\n"
        "1. 只能根据下方【文档内容】中提供的信息来回答问题。\n"
        "2. 回答中使用 [1]、[2] 等编号标注信息来源。\n"
        "3. 如果文档内容不足以回答用户的问题，你必须明确回复："
        "\"⚠️ 该问题涉及的内容在您上传的文档中未找到相关依据。\"\n"
        "4. 严禁编造、推测或使用文档中不存在的信息。\n"
        "5. 即使用户反复追问，也不得脱离文档内容作答。\n"
        f"\n### 文档内容 ###\n{context}"
    )

    client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

    try:
        stream = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            temperature=0.3,
            max_tokens=2048,
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        yield f"\n\nError: {str(e)}"
