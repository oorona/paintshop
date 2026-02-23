import base64
import io
import re
from typing import Optional, Tuple
from PIL import Image
import numpy as np


def base64_to_image(base64_string: str) -> Image.Image:
    """Convert base64 string to PIL Image."""
    # Remove data URL prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]

    image_data = base64.b64decode(base64_string)
    return Image.open(io.BytesIO(image_data))


def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert PIL Image to base64 string."""
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def bytes_to_base64(image_bytes: bytes) -> str:
    """Convert image bytes to base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")


def base64_to_bytes(base64_string: str) -> bytes:
    """Convert base64 string to bytes."""
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    return base64.b64decode(base64_string)


def get_image_dimensions(base64_string: str) -> Tuple[int, int]:
    """Get image dimensions from base64 string."""
    image = base64_to_image(base64_string)
    return image.size


def resize_image(
    base64_string: str,
    max_width: Optional[int] = None,
    max_height: Optional[int] = None,
    keep_aspect_ratio: bool = True
) -> str:
    """Resize image while optionally maintaining aspect ratio."""
    image = base64_to_image(base64_string)
    original_width, original_height = image.size

    if max_width and max_height:
        if keep_aspect_ratio:
            ratio = min(max_width / original_width, max_height / original_height)
            new_size = (int(original_width * ratio), int(original_height * ratio))
        else:
            new_size = (max_width, max_height)
    elif max_width:
        ratio = max_width / original_width
        new_size = (max_width, int(original_height * ratio))
    elif max_height:
        ratio = max_height / original_height
        new_size = (int(original_width * ratio), max_height)
    else:
        return base64_string

    resized = image.resize(new_size, Image.Resampling.LANCZOS)
    return image_to_base64(resized)


def create_mask_from_bounding_box(
    width: int,
    height: int,
    box: list,
    normalized: bool = True
) -> str:
    """Create a binary mask from bounding box coordinates."""
    # Box format: [y_min, x_min, y_max, x_max]
    mask = np.zeros((height, width), dtype=np.uint8)

    if normalized:
        # Coordinates are normalized to 0-1000
        y_min = int(box[0] * height / 1000)
        x_min = int(box[1] * width / 1000)
        y_max = int(box[2] * height / 1000)
        x_max = int(box[3] * width / 1000)
    else:
        y_min, x_min, y_max, x_max = box

    mask[y_min:y_max, x_min:x_max] = 255

    mask_image = Image.fromarray(mask, mode="L")
    return image_to_base64(mask_image)


def expand_mask_to_full_image(
    mask_base64: str,
    orig_width: int,
    orig_height: int,
    box: list,
    normalized: bool = True
) -> str:
    """
    Expand a small mask (covering bounding box area) to full image dimensions.
    
    The Gemini API returns masks that are sized to cover just the bounding box area.
    This function resizes the mask to the bounding box dimensions and places it
    on a full-size canvas matching the original image.
    
    Args:
        mask_base64: Base64 encoded PNG mask from Gemini API
        orig_width: Original image width
        orig_height: Original image height  
        box: Bounding box [y_min, x_min, y_max, x_max] normalized to 0-1000
        normalized: Whether box coordinates are normalized (0-1000)
    
    Returns:
        Base64 encoded full-size mask
    """
    # Parse bounding box coordinates
    if normalized:
        y_min = int(box[0] * orig_height / 1000)
        x_min = int(box[1] * orig_width / 1000)
        y_max = int(box[2] * orig_height / 1000)
        x_max = int(box[3] * orig_width / 1000)
    else:
        y_min, x_min, y_max, x_max = map(int, box)
    
    # Calculate bounding box dimensions
    box_width = max(1, x_max - x_min)
    box_height = max(1, y_max - y_min)
    
    # Load the small mask from Gemini
    small_mask = base64_to_image(mask_base64).convert("L")
    
    # Resize the mask to match bounding box dimensions
    resized_mask = small_mask.resize((box_width, box_height), Image.Resampling.LANCZOS)
    
    # Binarize at midpoint (127) as per documentation
    mask_array = np.array(resized_mask)
    mask_array = (mask_array > 127).astype(np.uint8) * 255
    resized_mask = Image.fromarray(mask_array, mode="L")
    
    # Create full-size canvas (all black = transparent)
    full_mask = Image.new("L", (orig_width, orig_height), 0)
    
    # Paste the resized mask at the bounding box position
    full_mask.paste(resized_mask, (x_min, y_min))
    
    return image_to_base64(full_mask)

def apply_mask_to_image(image_base64: str, mask_base64: str, invert: bool = False) -> str:
    """Apply a mask to an image, making masked areas transparent."""
    image = base64_to_image(image_base64).convert("RGBA")
    mask = base64_to_image(mask_base64).convert("L")

    # Resize mask to match image if needed
    if mask.size != image.size:
        mask = mask.resize(image.size, Image.Resampling.LANCZOS)

    mask_array = np.array(mask)
    if invert:
        mask_array = 255 - mask_array

    # Apply mask to alpha channel
    image_array = np.array(image)
    image_array[:, :, 3] = mask_array

    result = Image.fromarray(image_array, mode="RGBA")
    return image_to_base64(result)


def combine_masks(masks: list, operation: str = "union") -> str:
    """Combine multiple masks with specified operation."""
    if not masks:
        raise ValueError("No masks provided")

    result = base64_to_image(masks[0]).convert("L")
    result_array = np.array(result)

    for mask_b64 in masks[1:]:
        mask = base64_to_image(mask_b64).convert("L")
        if mask.size != result.size:
            mask = mask.resize(result.size, Image.Resampling.LANCZOS)
        mask_array = np.array(mask)

        if operation == "union":
            result_array = np.maximum(result_array, mask_array)
        elif operation == "intersection":
            result_array = np.minimum(result_array, mask_array)
        elif operation == "subtract":
            result_array = np.clip(result_array.astype(int) - mask_array.astype(int), 0, 255).astype(np.uint8)
        elif operation == "xor":
            result_array = np.abs(result_array.astype(int) - mask_array.astype(int)).astype(np.uint8)

    result_image = Image.fromarray(result_array, mode="L")
    return image_to_base64(result_image)


def extract_with_mask(image_base64: str, mask_base64: str) -> str:
    """Extract portion of image defined by mask."""
    image = base64_to_image(image_base64).convert("RGBA")
    mask = base64_to_image(mask_base64).convert("L")

    if mask.size != image.size:
        mask = mask.resize(image.size, Image.Resampling.LANCZOS)

    # Create new image with transparency
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.paste(image, mask=mask)

    return image_to_base64(result)


def composite_images(
    background_base64: str,
    foreground_base64: str,
    position: Tuple[int, int] = (0, 0),
    opacity: float = 1.0
) -> str:
    """Composite foreground image onto background at specified position."""
    background = base64_to_image(background_base64).convert("RGBA")
    foreground = base64_to_image(foreground_base64).convert("RGBA")

    # Adjust opacity if needed
    if opacity < 1.0:
        alpha = foreground.split()[3]
        alpha = alpha.point(lambda x: int(x * opacity))
        foreground.putalpha(alpha)

    # Create a new image for compositing
    result = background.copy()
    result.paste(foreground, position, foreground)

    return image_to_base64(result)


def create_mask_from_array(mask_data: list, width: int, height: int) -> str:
    """Convert raw mask pixel data (list) to a base64-encoded PNG mask image.
    
    Args:
        mask_data: List of pixel values or 2D list representing mask data
        width: Expected width of the mask
        height: Expected height of the mask
    
    Returns:
        Base64-encoded PNG mask image
    """
    try:
        # Try to interpret as numpy-compatible array
        mask_array = np.array(mask_data, dtype=np.uint8)
        
        # Handle different shapes
        if mask_array.ndim == 1:
            # Flat array - try to reshape to 2D
            total_elements = len(mask_array)
            if total_elements == width * height:
                mask_array = mask_array.reshape((height, width))
            else:
                # Best effort: create a proportional mask
                aspect_ratio = width / height if height > 0 else 1
                calc_height = int(np.sqrt(total_elements / aspect_ratio))
                calc_width = int(total_elements / calc_height) if calc_height > 0 else total_elements
                if calc_height * calc_width == total_elements:
                    mask_array = mask_array.reshape((calc_height, calc_width))
                else:
                    # Fallback: create white mask of expected dimensions
                    mask_array = np.ones((height, width), dtype=np.uint8) * 255
        elif mask_array.ndim == 2:
            # Already 2D - ensure proper shape if needed
            pass
        else:
            # Higher dimensions - take first channel or flatten
            mask_array = mask_array.reshape(-1)[:width * height].reshape((height, width))
        
        # Normalize values to 0-255 if needed
        if mask_array.max() <= 1:
            mask_array = (mask_array * 255).astype(np.uint8)
        
        # Resize to target dimensions if needed
        mask_image = Image.fromarray(mask_array, mode="L")
        if mask_image.size != (width, height) and width > 0 and height > 0:
            mask_image = mask_image.resize((width, height), Image.Resampling.BILINEAR)
        
        return image_to_base64(mask_image)
    except Exception as e:
        print(f"Error creating mask from array: {e}")
        # Return a white (valid) mask as fallback
        fallback = Image.new("L", (width if width > 0 else 256, height if height > 0 else 256), 255)
        return image_to_base64(fallback)


def get_aspect_ratio_dimensions(aspect_ratio: str, base_size: int = 1024) -> Tuple[int, int]:
    """Calculate dimensions from aspect ratio string."""
    ratios = {
        "1:1": (1, 1),
        "2:3": (2, 3),
        "3:2": (3, 2),
        "3:4": (3, 4),
        "4:3": (4, 3),
        "4:5": (4, 5),
        "5:4": (5, 4),
        "9:16": (9, 16),
        "16:9": (16, 9),
        "21:9": (21, 9),
    }

    w_ratio, h_ratio = ratios.get(aspect_ratio, (1, 1))

    # Calculate dimensions that fit within base_size
    if w_ratio >= h_ratio:
        width = base_size
        height = int(base_size * h_ratio / w_ratio)
    else:
        height = base_size
        width = int(base_size * w_ratio / h_ratio)

    return width, height
