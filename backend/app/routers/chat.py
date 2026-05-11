import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.schemas import ChatRequest, ChatResponse, ChatCitation
from app.services.rag import generate_answer, generate_answer_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest):
    result = await generate_answer(body.notebook_id, body.message, body.top_k)
    citations = [
        ChatCitation(
            index=c["index"],
            source=c["source"],
            page=c.get("page"),
            snippet=c["snippet"],
        )
        for c in result.get("citations", [])
    ]
    return ChatResponse(answer=result["answer"], citations=citations)


@router.post("/stream")
async def chat_stream(body: ChatRequest):
    async def event_generator():
        try:
            async for token in generate_answer_stream(body.notebook_id, body.message, body.top_k):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
