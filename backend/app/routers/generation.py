from fastapi import APIRouter, HTTPException
from typing import Optional

from ..models.schemas import (
    GenerateImageRequest, EditImageRequest, MultiImageEditRequest,
    StyleTransferRequest, InpaintingRequest, GenerationResponse
)
from ..services.gemini_service import gemini_service
from ..services.session_service import session_service

router = APIRouter(prefix="/api", tags=["Generation"])


@router.post("/generate", response_model=GenerationResponse)
async def generate_image(request: GenerateImageRequest):
    """Generate an image from text prompt."""
    # Get style prompt if style_id provided
    style_prompt = None
    if request.style_id:
        from .styles import get_style_prompt
        style_prompt = get_style_prompt(request.style_id)

    result = await gemini_service.generate_image(
        prompt=request.prompt,
        model=request.model,
        aspect_ratio=request.aspect_ratio,
        image_size=request.image_size,
        style_prompt=style_prompt,
        use_grounding=request.use_grounding,
        thinking_level=request.thinking_level
    )

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


@router.post("/edit", response_model=GenerationResponse)
async def edit_image(request: EditImageRequest):
    """Edit an existing image with text prompt."""
    style_prompt = None
    if request.style_id:
        from .styles import get_style_prompt
        style_prompt = get_style_prompt(request.style_id)

    result = await gemini_service.edit_image(
        prompt=request.prompt,
        image_data=request.image_data,
        model=request.model,
        mask_data=request.mask_data,
        style_prompt=style_prompt,
        use_grounding=request.use_grounding,
        thinking_level=request.thinking_level
    )

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

    result = await gemini_service.multi_image_edit(
        prompt=request.prompt,
        images=request.images,
        model=request.model,
        style_prompt=style_prompt,
        use_grounding=request.use_grounding,
        thinking_level=request.thinking_level
    )

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
    result = await gemini_service.style_transfer(
        image_data=request.image_data,
        style_reference=request.style_reference,
        prompt=request.prompt,
        model=request.model,
        style_strength=request.style_strength
    )

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
    result = await gemini_service.inpaint(
        image_data=request.image_data,
        mask_data=request.mask_data,
        prompt=request.prompt,
        model=request.model,
        preserve_background=request.preserve_background
    )

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
