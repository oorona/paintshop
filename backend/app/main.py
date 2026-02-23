from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any
import time

from .routers import generation, understanding, styles, workflows, projects, memes
from .services.session_service import session_service
from .models.schemas import ModelType, AspectRatio, ImageSize, ThinkingLevel, MediaResolution

app = FastAPI(
    title="Gemini AI Image Editor API",
    description="Backend API for AI-powered image editing using Google Gemini",
    version="1.0.0",
)

# CORS configuration - only allow frontend origin
# In production, this would be more restrictive
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Docker, frontend accesses via internal network
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Include routers
app.include_router(generation.router)
app.include_router(understanding.router)
app.include_router(styles.router)
app.include_router(workflows.router)
app.include_router(projects.router)
app.include_router(memes.router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/api/models")
async def list_models():
    """List available Gemini models and their capabilities."""
    return {
        "models": [
            {
                "id": ModelType.GEMINI_25_FLASH_IMAGE.value,
                "name": "Gemini 2.5 Flash Image",
                "description": "Fast image generation and editing",
                "capabilities": ["generate", "edit", "inpaint"],
                "supports_grounding": False,
                "max_images": 1,
                "supported_sizes": ["1K", "2K"],
                "supported_aspect_ratios": [ar.value for ar in AspectRatio],
            },
            {
                "id": ModelType.GEMINI_3_PRO_IMAGE.value,
                "name": "Gemini 3 Pro Image",
                "description": "High-quality 4K image generation with grounding",
                "capabilities": ["generate", "edit", "inpaint", "style_transfer", "multi_image"],
                "supports_grounding": True,
                "max_images": 14,
                "supported_sizes": ["1K", "2K", "4K"],
                "supported_aspect_ratios": [ar.value for ar in AspectRatio],
            },
            {
                "id": ModelType.GEMINI_3_FLASH.value,
                "name": "Gemini 3 Flash",
                "description": "Fast object detection and segmentation",
                "capabilities": ["detect", "segment", "understand"],
                "supports_grounding": False,
                "max_images": 1,
                "media_resolution_options": [mr.value for mr in MediaResolution],
            },
            {
                "id": ModelType.GEMINI_3_PRO.value,
                "name": "Gemini 3 Pro",
                "description": "Advanced text reasoning and prompt assistance",
                "capabilities": ["prompt_assist", "understand"],
                "supports_grounding": True,
                "thinking_levels": [tl.value for tl in ThinkingLevel],
            },
        ]
    }


@app.get("/api/config")
async def get_config():
    """Get available configuration options."""
    return {
        "aspect_ratios": [
            {"value": ar.value, "label": ar.value} for ar in AspectRatio
        ],
        "image_sizes": [
            {"value": size.value, "label": size.value} for size in ImageSize
        ],
        "thinking_levels": [
            {"value": tl.value, "label": tl.value.title(), "description": get_thinking_description(tl)}
            for tl in ThinkingLevel
        ],
        "media_resolutions": [
            {"value": mr.value, "label": mr.value.title(), "description": get_resolution_description(mr)}
            for mr in MediaResolution
        ],
        "blend_modes": [
            "normal", "multiply", "screen", "overlay", "darken", "lighten",
            "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion"
        ],
        "mask_operations": [
            {"value": "union", "label": "Union (OR)", "description": "Combine masks"},
            {"value": "intersection", "label": "Intersection (AND)", "description": "Overlap only"},
            {"value": "subtract", "label": "Subtract", "description": "Remove second from first"},
            {"value": "xor", "label": "Exclusive Or", "description": "Non-overlapping areas"},
        ],
    }


def get_thinking_description(level: ThinkingLevel) -> str:
    descriptions = {
        ThinkingLevel.MINIMAL: "Fastest, minimal reasoning",
        ThinkingLevel.LOW: "Quick responses, basic reasoning",
        ThinkingLevel.MEDIUM: "Balanced speed and quality",
        ThinkingLevel.HIGH: "Best quality, deeper reasoning",
    }
    return descriptions.get(level, "")


def get_resolution_description(resolution: MediaResolution) -> str:
    descriptions = {
        MediaResolution.LOW: "70 tokens per image, fastest",
        MediaResolution.MEDIUM: "560 tokens per image, balanced",
        MediaResolution.HIGH: "1120 tokens per image, best detail",
    }
    return descriptions.get(resolution, "")


@app.get("/api/session/{session_id}/stats")
async def get_session_stats(session_id: str):
    """Get session statistics including token usage and costs."""
    stats = session_service.get_session_stats(session_id)
    if not stats:
        return JSONResponse(
            status_code=404,
            content={"error": "Session not found"}
        )
    return stats


@app.get("/api/sessions")
async def list_sessions():
    """List all sessions with summary info."""
    return session_service.list_sessions()


@app.delete("/api/session/{session_id}")
async def clear_session(session_id: str):
    """Clear a session's history."""
    session_service.clear_session(session_id)
    return {"message": "Session cleared"}


@app.get("/api/pricing")
async def get_pricing():
    """Get current model pricing information."""
    from .utils.cost_calculator import PRICING
    return {
        "currency": "USD",
        "unit": "per 1M tokens",
        "models": PRICING
    }


# Error handling
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__}
    )
