from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import time
import json

from ..models.schemas import (
    GenerateImageRequest, EditImageRequest, MultiImageEditRequest,
    StyleTransferRequest, InpaintingRequest, GenerationResponse
)
from ..services.gemini_service import gemini_service
from ..services.session_service import session_service
from ..utils.cost_calculator import calculate_cost
from ..utils.image_utils import bytes_to_base64

router = APIRouter(prefix="/api", tags=["Generation"])


def _jsonl(event: dict) -> str:
    return json.dumps(event) + "\n"


@router.post("/generate", response_model=GenerationResponse)
async def generate_image(request: GenerateImageRequest):
    """Generate an image from text prompt."""
    # Get style prompt if style_id provided
    style_prompt = None
    if request.style_id:
        from .styles import get_style_prompt
        style_prompt = get_style_prompt(request.style_id)

    started_at = time.perf_counter()
    result = await gemini_service.generate_image(
        prompt=request.prompt,
        model=request.model,
        aspect_ratio=request.aspect_ratio,
        image_size=request.image_size,
        style_prompt=style_prompt,
        use_grounding=request.use_grounding,
        thinking_level=request.thinking_level
    )
    result.duration_ms = round((time.perf_counter() - started_at) * 1000)

    # Record session stats
    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session(request.session_id)
        session_service.record_request(
            session_id=session_id,
            request_type="generate",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )
        result.session_id = session_id

    return result


@router.post("/generate/stream")
async def generate_image_stream(request: GenerateImageRequest):
    """Stream model thoughts while generating an image."""
    style_prompt = None
    if request.style_id:
        from .styles import get_style_prompt
        style_prompt = get_style_prompt(request.style_id)

    async def event_stream():
        started_at = time.perf_counter()
        session_id = session_service.get_or_create_session(request.session_id)
        yield _jsonl({"type": "session", "session_id": session_id})

        if not gemini_service.client:
            yield _jsonl({"type": "error", "error": "Gemini API not configured"})
            return

        try:
            full_prompt = gemini_service._build_generation_prompt(request.prompt, style_prompt)
            config = gemini_service._get_generation_config(
                request.model,
                request.aspect_ratio,
                request.image_size,
                request.thinking_level,
                include_thoughts=True
            )

            text_response = ""
            image_base64 = None
            usage_chunk = None

            stream = gemini_service.client.models.generate_content_stream(
                model=request.model.value,
                contents=full_prompt,
                config=config,
            )

            for chunk in stream:
                if getattr(chunk, "usage_metadata", None) is not None:
                    usage_chunk = chunk

                candidates = getattr(chunk, "candidates", None) or []
                if not candidates:
                    continue

                content = getattr(candidates[0], "content", None)
                parts = getattr(content, "parts", None) or []

                for part in parts:
                    part_text = getattr(part, "text", None)
                    is_thought = bool(getattr(part, "thought", False))

                    if part_text:
                        if is_thought:
                            yield _jsonl({"type": "thought", "text": part_text})
                        else:
                            text_response += part_text
                    elif getattr(part, "inline_data", None):
                        image_base64 = bytes_to_base64(part.inline_data.data)
                        if is_thought:
                            yield _jsonl({"type": "thought", "text": "[interim image generated]"})

            token_usage = gemini_service._extract_token_usage(usage_chunk) if usage_chunk else None
            cost_estimate = None
            if token_usage:
                cost_estimate = calculate_cost(
                    model=request.model.value,
                    input_tokens=token_usage.input_tokens,
                    output_tokens=token_usage.output_tokens,
                    output_images=1 if image_base64 else 0
                )

            duration_ms = round((time.perf_counter() - started_at) * 1000)
            result = GenerationResponse(
                success=bool(image_base64),
                image_base64=image_base64,
                text_response=text_response or None,
                duration_ms=duration_ms,
                token_usage=token_usage,
                cost_estimate=cost_estimate,
                session_id=session_id,
                error=None if image_base64 else "Generation returned no image"
            )

            if result.success and result.token_usage and result.cost_estimate:
                session_service.record_request(
                    session_id=session_id,
                    request_type="generate",
                    token_usage=result.token_usage,
                    cost_estimate=result.cost_estimate,
                    model=request.model.value,
                    prompt=request.prompt
                )

            yield _jsonl({"type": "result", "data": result.model_dump()})
        except Exception as exc:
            yield _jsonl({"type": "error", "error": str(exc)})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.post("/edit", response_model=GenerationResponse)
async def edit_image(request: EditImageRequest):
    """Edit an existing image with text prompt."""
    style_prompt = None
    if request.style_id:
        from .styles import get_style_prompt
        style_prompt = get_style_prompt(request.style_id)

    started_at = time.perf_counter()
    result = await gemini_service.edit_image(
        prompt=request.prompt,
        image_data=request.image_data,
        model=request.model,
        mask_data=request.mask_data,
        aspect_ratio=request.aspect_ratio,
        image_size=request.image_size,
        style_prompt=style_prompt,
        use_grounding=request.use_grounding,
        thinking_level=request.thinking_level
    )
    result.duration_ms = round((time.perf_counter() - started_at) * 1000)

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session(request.session_id)
        session_service.record_request(
            session_id=session_id,
            request_type="edit",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )
        result.session_id = session_id

    return result


@router.post("/edit/multi", response_model=GenerationResponse)
async def multi_image_edit(request: MultiImageEditRequest):
    """Edit/compose multiple images together."""
    style_prompt = None
    if request.style_id:
        from .styles import get_style_prompt
        style_prompt = get_style_prompt(request.style_id)

    started_at = time.perf_counter()
    result = await gemini_service.multi_image_edit(
        prompt=request.prompt,
        images=request.images,
        model=request.model,
        aspect_ratio=request.aspect_ratio,
        image_size=request.image_size,
        style_prompt=style_prompt,
        use_grounding=request.use_grounding,
        thinking_level=request.thinking_level
    )
    result.duration_ms = round((time.perf_counter() - started_at) * 1000)

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session(request.session_id)
        session_service.record_request(
            session_id=session_id,
            request_type="multi_edit",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )
        result.session_id = session_id

    return result


@router.post("/style-transfer", response_model=GenerationResponse)
async def style_transfer(request: StyleTransferRequest):
    """Apply style from reference image to source image."""
    started_at = time.perf_counter()
    result = await gemini_service.style_transfer(
        image_data=request.image_data,
        style_reference=request.style_reference,
        prompt=request.prompt,
        model=request.model,
        style_strength=request.style_strength
    )
    result.duration_ms = round((time.perf_counter() - started_at) * 1000)

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session()
        session_service.record_request(
            session_id=session_id,
            request_type="style_transfer",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )
        result.session_id = session_id

    return result


@router.post("/inpaint", response_model=GenerationResponse)
async def inpaint(request: InpaintingRequest):
    """Inpaint masked area of image."""
    started_at = time.perf_counter()
    result = await gemini_service.inpaint(
        image_data=request.image_data,
        mask_data=request.mask_data,
        prompt=request.prompt,
        model=request.model,
        preserve_background=request.preserve_background
    )
    result.duration_ms = round((time.perf_counter() - started_at) * 1000)

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session()
        session_service.record_request(
            session_id=session_id,
            request_type="inpaint",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )
        result.session_id = session_id

    return result
