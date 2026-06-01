import json
import re
import logging
from openai import OpenAI

from app.config import get_settings
from app.database import query_chunks
from app.services.embedder import embed_query, embed_texts

logger = logging.getLogger(__name__)


def _build_system_prompt(context: str, language: str = "zh") -> str:
    if language == "zh":
        return (
            "你是一个严格基于用户文档的研究助手。你必须严格遵守以下规则：\n"
            "1. 只能根据下方【文档内容】中提供的信息来回答问题。\n"
            "2. 回答中使用 [1]、[2] 等编号标注信息来源。\n"
            "3. 如果文档内容不足以回答用户的问题，你必须明确回复："
            "\"⚠️ 该问题涉及的内容在您上传的文档中未找到相关依据。\"\n"
            "4. 严禁编造、推测或使用文档中不存在的信息。\n"
            "5. 即使用户反复追问，也不得脱离文档内容作答。\n"
            "6. 尽可能提供完整、详细的回答，但不要超出文档范围。\n"
            f"\n### 文档内容 ###\n{context}"
        )
    else:
        return (
            "You are a research assistant strictly bound by the provided documents. "
            "You must follow these rules:\n"
            "1. Answer only using information found in the [Document Content] below.\n"
            "2. Cite sources using [1], [2] notation in your answer.\n"
            "3. If the documents are insufficient, reply with: "
            "\"⚠️ The uploaded documents do not contain sufficient information on this topic.\"\n"
            "4. Never fabricate, speculate, or use information not in the documents.\n"
            "5. Provide detailed answers where possible, but stay within document scope.\n"
            f"\n### Document Content ###\n{context}"
        )


async def _hyde_expand_query(question: str) -> str:
    settings = get_settings()
    if not settings.hyde_enabled:
        return question
    if not settings.is_llm_configured:
        return question
    try:
        client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
        resp = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a document content generator. Given a question, "
                        "write a short paragraph that a relevant document would contain "
                        "as an answer. Write in the same language as the question. "
                        "Keep it under 150 words. Only output the paragraph, nothing else."
                    )
                },
                {"role": "user", "content": question},
            ],
            temperature=0.3,
            max_tokens=200,
        )
        hypothetical = resp.choices[0].message.content
        if hypothetical and len(hypothetical.strip()) > 10:
            logger.info(f"HyDE expanded query: {hypothetical[:100]}...")
            return hypothetical.strip()
    except Exception as e:
        logger.warning(f"HyDE expansion failed: {e}")
    return question


def _detect_language(text: str) -> str:
    has_cjk = bool(re.search(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', text))
    return "zh" if has_cjk else "en"


def _build_context_and_citations(
    results: list[dict],
) -> tuple[str, list[dict]]:
    context_parts = []
    citations = []
    for i, item in enumerate(results, 1):
        meta = item["metadata"]
        source = meta.get("source", meta.get("filename", "unknown"))
        page = meta.get("page")
        heading = " | ".join(filter(None, [
            meta.get("h1"), meta.get("h2"), meta.get("h3")
        ]))
        header_line = f"[{i}] Source: {source}"
        if page:
            header_line += f" (Page {page})"
        if heading:
            header_line += f" — {heading}"
        context_parts.append(header_line + f"\n{item['text']}")
        citations.append({
            "index": i,
            "source": source,
            "page": page,
            "snippet": item["text"][:300],
        })
    context = "\n\n".join(context_parts)
    return context, citations


def _build_chat_messages(
    question: str,
    system_prompt: str,
    history: list[dict] | None = None,
) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        for h in history:
            role = h.get("role", "user")
            content = h.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        if len(messages) > 1:
            context_msg = (
                "\n---\n以上是之前的对话历史。现在请基于上面的对话上下文和文档内容，"
                "回答下面的最新问题。回答中仍要使用文档提供的引用标注[1][2]等。"
            )
            messages[-1] = {
                "role": messages[-1]["role"],
                "content": messages[-1]["content"] + context_msg
            }
    messages.append({"role": "user", "content": question})
    return messages


async def generate_answer(
    notebook_id: str,
    question: str,
    top_k: int | None = None,
    chat_history: list[dict] | None = None,
) -> dict:
    settings = get_settings()
    top_k = top_k or settings.retrieval_top_k

    search_query = question
    if settings.hyde_enabled:
        try:
            search_query = await _hyde_expand_query(question)
        except Exception:
            pass

    q_embedding = embed_query(search_query)
    if q_embedding is None:
        return {"answer": "Error: Embedding service unavailable.", "citations": []}

    results = query_chunks(notebook_id, q_embedding, top_k=top_k)

    if not results:
        return {
            "answer": "当前笔记本中未找到相关文档。请先上传一些源文件。",
            "citations": [],
        }

    context, citations = _build_context_and_citations(results)
    lang = _detect_language(question)
    system_prompt = _build_system_prompt(context, lang)
    messages = _build_chat_messages(question, system_prompt, chat_history)

    client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

    try:
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
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
    chat_history: list[dict] | None = None,
):
    settings = get_settings()
    top_k = top_k or settings.retrieval_top_k

    search_query = question
    if settings.hyde_enabled:
        try:
            search_query = await _hyde_expand_query(question)
        except Exception:
            pass

    q_embedding = embed_query(search_query)
    if q_embedding is None:
        yield json.dumps({"error": "Embedding service unavailable."})
        return

    results = query_chunks(notebook_id, q_embedding, top_k=top_k)

    if not results:
        yield json.dumps({"token": "当前笔记本中未找到相关文档。请先上传一些源文件。"})
        yield json.dumps({"citations": []})
        return

    context, citations = _build_context_and_citations(results)
    lang = _detect_language(question)
    system_prompt = _build_system_prompt(context, lang)
    messages = _build_chat_messages(question, system_prompt, chat_history)

    yield json.dumps({"citations": citations})

    client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

    try:
        stream = client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield json.dumps({"token": chunk.choices[0].delta.content})
    except Exception as e:
        yield json.dumps({"error": str(e)})
