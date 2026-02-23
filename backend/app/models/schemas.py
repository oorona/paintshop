from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class ModelType(str, Enum):
    GEMINI_25_FLASH_IMAGE = "gemini-2.5-flash-image"
    GEMINI_25_FLASH_PREVIEW = "gemini-2.5-flash"  # For segmentation
    GEMINI_3_PRO_IMAGE = "gemini-3-pro-image-preview"
    GEMINI_3_PRO = "gemini-3-pro-preview"
    GEMINI_3_FLASH = "gemini-3-flash-preview"


class AspectRatio(str, Enum):
    SQUARE = "1:1"
    PORTRAIT_2_3 = "2:3"
    LANDSCAPE_3_2 = "3:2"
    PORTRAIT_3_4 = "3:4"
    LANDSCAPE_4_3 = "4:3"
    PORTRAIT_4_5 = "4:5"
    LANDSCAPE_5_4 = "5:4"
    VERTICAL = "9:16"
    HORIZONTAL = "16:9"
    ULTRAWIDE = "21:9"


class ImageSize(str, Enum):
    SIZE_1K = "1K"
    SIZE_2K = "2K"
    SIZE_4K = "4K"


class ThinkingLevel(str, Enum):
    MINIMAL = "minimal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class MediaResolution(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class GenerateImageRequest(BaseModel):
    prompt: str
    model: ModelType = ModelType.GEMINI_25_FLASH_IMAGE
    aspect_ratio: AspectRatio = AspectRatio.SQUARE
    image_size: ImageSize = ImageSize.SIZE_1K
    style_id: Optional[str] = None
    use_grounding: bool = False
    thinking_level: ThinkingLevel = ThinkingLevel.HIGH
    session_id: Optional[str] = None


class EditImageRequest(BaseModel):
    prompt: str
    image_data: str  # Base64 encoded
    model: ModelType = ModelType.GEMINI_25_FLASH_IMAGE
    aspect_ratio: Optional[AspectRatio] = None
    image_size: Optional[ImageSize] = None
    style_id: Optional[str] = None
    use_grounding: bool = False
    thinking_level: ThinkingLevel = ThinkingLevel.HIGH
    session_id: Optional[str] = None
    mask_data: Optional[str] = None  # Base64 encoded mask for inpainting


class MultiImageEditRequest(BaseModel):
    prompt: str
    images: List[str]  # List of Base64 encoded images
    model: ModelType = ModelType.GEMINI_3_PRO_IMAGE
    aspect_ratio: AspectRatio = AspectRatio.SQUARE
    image_size: ImageSize = ImageSize.SIZE_1K
    style_id: Optional[str] = None
    use_grounding: bool = False
    thinking_level: ThinkingLevel = ThinkingLevel.HIGH
    session_id: Optional[str] = None


class SegmentationRequest(BaseModel):
    image_data: str  # Base64 encoded
    prompt: str = "Detect and segment all objects in the image"
    model: ModelType = ModelType.GEMINI_3_FLASH
    media_resolution: MediaResolution = MediaResolution.HIGH


class ObjectDetectionRequest(BaseModel):
    image_data: str  # Base64 encoded
    prompt: str = "Detect all prominent objects in the image"
    model: ModelType = ModelType.GEMINI_3_FLASH
    media_resolution: MediaResolution = MediaResolution.HIGH


class ImageUnderstandingRequest(BaseModel):
    image_data: str  # Base64 encoded
    prompt: str
    model: ModelType = ModelType.GEMINI_3_FLASH
    media_resolution: MediaResolution = MediaResolution.HIGH


class PromptAssistRequest(BaseModel):
    context: str
    task_type: str  # "generate", "edit", "style", "segmentation"
    model: ModelType = ModelType.GEMINI_3_PRO
    thinking_level: ThinkingLevel = ThinkingLevel.HIGH


class StyleTransferRequest(BaseModel):
    image_data: str  # Base64 encoded source image
    style_reference: str  # Base64 encoded style image OR style description
    prompt: str
    model: ModelType = ModelType.GEMINI_3_PRO_IMAGE
    style_strength: float = Field(default=0.7, ge=0.0, le=1.0)


class InpaintingRequest(BaseModel):
    image_data: str  # Base64 encoded
    mask_data: str  # Base64 encoded mask (white = area to inpaint)
    prompt: str
    model: ModelType = ModelType.GEMINI_3_PRO_IMAGE
    preserve_background: bool = True


class BoundingBox(BaseModel):
    label: str
    box: List[int]  # [y_min, x_min, y_max, x_max] normalized to 0-1000
    confidence: Optional[float] = None


class SegmentationResult(BaseModel):
    label: str
    box: List[int]
    mask_base64: str  # Base64 encoded PNG mask


class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int


class CostEstimate(BaseModel):
    input_cost: float
    output_cost: float
    total_cost: float
    currency: str = "USD"


class GenerationResponse(BaseModel):
    success: bool
    image_base64: Optional[str] = None
    text_response: Optional[str] = None
    token_usage: Optional[TokenUsage] = None
    cost_estimate: Optional[CostEstimate] = None
    grounding_metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    session_id: Optional[str] = None


class SegmentationResponse(BaseModel):
    success: bool
    segments: List[SegmentationResult] = []
    token_usage: Optional[TokenUsage] = None
    cost_estimate: Optional[CostEstimate] = None
    error: Optional[str] = None


class ObjectDetectionResponse(BaseModel):
    success: bool
    objects: List[BoundingBox] = []
    token_usage: Optional[TokenUsage] = None
    cost_estimate: Optional[CostEstimate] = None
    error: Optional[str] = None


class Style(BaseModel):
    id: str
    name: str
    category: str
    prompt_template: str
    description: str
    example_prompt: Optional[str] = None
    tags: List[str] = []


class PromptTemplate(BaseModel):
    id: str
    name: str
    category: str
    template: str
    variables: List[str] = []
    description: str
    example_filled: Optional[str] = None


class WorkflowStep(BaseModel):
    step_type: str  # "generate", "segment", "edit", "detect", "mask_op"
    prompt_template_id: Optional[str] = None
    style_id: Optional[str] = None
    parameters: Dict[str, Any] = {}


class Workflow(BaseModel):
    id: str
    name: str
    description: str
    steps: List[WorkflowStep]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Layer(BaseModel):
    id: str
    name: str
    type: str  # "image", "mask", "generated"
    image_base64: str
    visible: bool = True
    opacity: float = 1.0
    blend_mode: str = "normal"
    order: int = 0


class Project(BaseModel):
    id: str
    name: str
    layers: List[Layer] = []
    width: int
    height: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SessionStats(BaseModel):
    session_id: str
    total_requests: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost: float = 0.0
    requests: List[Dict[str, Any]] = []
