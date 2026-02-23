from fastapi import APIRouter

from ..models.schemas import (
    SegmentationRequest, ObjectDetectionRequest, ImageUnderstandingRequest,
    SegmentationResponse, ObjectDetectionResponse, GenerationResponse
)
from ..services.gemini_service import gemini_service
from ..services.session_service import session_service

router = APIRouter(prefix="/api", tags=["Understanding"])


@router.post("/segment", response_model=SegmentationResponse)
async def segment_objects(request: SegmentationRequest):
    """Perform semantic segmentation to extract object masks."""
    result = await gemini_service.segment_objects(
        image_data=request.image_data,
        prompt=request.prompt,
        model=request.model,
        media_resolution=request.media_resolution
    )

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session()
        session_service.record_request(
            session_id=session_id,
            request_type="segment",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )

    return result


@router.post("/detect", response_model=ObjectDetectionResponse)
async def detect_objects(request: ObjectDetectionRequest):
    """Detect objects and return bounding boxes."""
    result = await gemini_service.detect_objects(
        image_data=request.image_data,
        prompt=request.prompt,
        model=request.model,
        media_resolution=request.media_resolution
    )

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session()
        session_service.record_request(
            session_id=session_id,
            request_type="detect",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )

    return result


@router.post("/understand", response_model=GenerationResponse)
async def understand_image(request: ImageUnderstandingRequest):
    """General image understanding - captioning, VQA, analysis."""
    result = await gemini_service.understand_image(
        image_data=request.image_data,
        prompt=request.prompt,
        model=request.model,
        media_resolution=request.media_resolution
    )

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session()
        session_service.record_request(
            session_id=session_id,
            request_type="understand",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.prompt
        )

    return result
