from typing import Dict, Tuple
from ..models.schemas import ModelType, TokenUsage, CostEstimate

# Pricing per 1M tokens (USD) - Updated for Gemini models
# These are approximate and should be updated based on actual Google pricing
PRICING: Dict[str, Dict[str, float]] = {
    ModelType.GEMINI_25_FLASH_IMAGE.value: {
        "input": 0.10,
        "output": 0.40,
        "image_input": 0.02,  # Per image
        "image_output": 0.04,  # Per generated image
    },
    ModelType.GEMINI_3_PRO_IMAGE.value: {
        "input": 1.25,
        "output": 5.00,
        "image_input": 0.05,
        "image_output": 0.10,
    },
    ModelType.GEMINI_3_FLASH.value: {
        "input": 0.10,
        "output": 0.40,
        "image_input": 0.02,
        "image_output": 0.04,
    },
    ModelType.GEMINI_3_PRO.value: {
        "input": 1.25,
        "output": 5.00,
        "image_input": 0.05,
        "image_output": 0.10,
    },
}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    input_images: int = 0,
    output_images: int = 0
) -> CostEstimate:
    """Calculate cost based on token and image usage."""
    pricing = PRICING.get(model, PRICING[ModelType.GEMINI_25_FLASH_IMAGE.value])

    # Calculate text token costs (per 1M tokens)
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]

    # Add image costs
    input_cost += input_images * pricing.get("image_input", 0)
    output_cost += output_images * pricing.get("image_output", 0)

    return CostEstimate(
        input_cost=round(input_cost, 6),
        output_cost=round(output_cost, 6),
        total_cost=round(input_cost + output_cost, 6),
        currency="USD"
    )


def estimate_image_tokens(width: int, height: int, resolution: str = "high") -> int:
    """Estimate tokens for an image based on dimensions and resolution setting."""
    # Based on Gemini documentation:
    # high: 1120 tokens max
    # medium: 560 tokens
    # low: 70 tokens
    resolution_tokens = {
        "high": 1120,
        "medium": 560,
        "low": 70
    }
    return resolution_tokens.get(resolution, 1120)


def get_model_pricing(model: str) -> Dict[str, float]:
    """Get pricing info for a specific model."""
    return PRICING.get(model, PRICING[ModelType.GEMINI_25_FLASH_IMAGE.value])


def format_cost_display(cost: CostEstimate) -> str:
    """Format cost for display."""
    return f"${cost.total_cost:.6f} (Input: ${cost.input_cost:.6f}, Output: ${cost.output_cost:.6f})"
