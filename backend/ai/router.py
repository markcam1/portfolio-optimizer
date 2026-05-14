import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ai.analyzer import stream_analysis, OllamaUnavailableError, OllamaModelNotFoundError, OLLAMA_MODEL
from services.run_store import load_run, save_analysis

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalyzeRequest(BaseModel):
    run_id: str


async def _sse_generator(run_id: str):
    result = load_run(run_id)
    if result is None:
        yield "data: [ERROR] Run not found.\n\n"
        return

    full_text: list[str] = []
    try:
        async for chunk in stream_analysis(result):
            full_text.append(chunk)
            # Encode as JSON so embedded newlines survive SSE framing
            yield f"data: {json.dumps({'t': chunk})}\n\n"
    except OllamaUnavailableError:
        yield (
            "data: [ERROR] Ollama is not running. "
            "Start it with 'ollama serve' and try again.\n\n"
        )
        return
    except OllamaModelNotFoundError:
        yield (
            f"data: [ERROR] Model '{OLLAMA_MODEL}' not found. "
            f"Run 'ollama pull {OLLAMA_MODEL}' and try again.\n\n"
        )
        return
    except Exception as exc:
        logger.error("AI analysis error: %s", exc)
        yield f"data: [ERROR] Analysis failed: {exc}\n\n"
        return

    save_analysis(run_id, "".join(full_text))
    yield "data: [DONE]\n\n"


@router.post("/ai/analyze")
async def analyze(req: AnalyzeRequest):
    return StreamingResponse(
        _sse_generator(req.run_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
