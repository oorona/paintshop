import os
import base64
import json
import re
from typing import Optional, List, Dict, Any, Tuple
from google import genai
from google.genai import types
from PIL import Image
import io

from ..models.schemas import (
    ModelType, AspectRatio, ImageSize, ThinkingLevel, MediaResolution,
    TokenUsage, CostEstimate, BoundingBox, SegmentationResult,
    GenerationResponse, SegmentationResponse, ObjectDetectionResponse
)
from ..utils.cost_calculator import calculate_cost
from ..utils.image_utils import base64_to_bytes, bytes_to_base64, base64_to_image, image_to_base64, create_mask_from_bounding_box, expand_mask_to_full_image


class GeminiService:
    """Service for interacting with Google Gemini API for image operations."""

    def __init__(self):
        self.client = None
        self._init_client()

    def _init_client(self):
        """Initialize the Gemini client with API key from secrets."""
        api_key = None

        def read_key(candidate_paths):
            for path in candidate_paths:
                if path and os.path.exists(path):
                    with open(path, "r") as f:
                        key = f.read().strip()
                        if key:
                            return key
            return None

        # Ordered lookup: explicit env path -> docker secret -> repo secrets file
        candidate_paths = [
            os.environ.get("GEMINI_API_KEY_FILE"),
            "/run/secrets/gemini_api_key",
            os.path.join(os.getcwd(), "secrets", "gemini_api_key.txt"),
            os.path.join(os.path.dirname(__file__), "../../..", "secrets", "gemini_api_key.txt"),
        ]

        api_key = read_key(candidate_paths)

        # Fallback to environment variable
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY")

        if api_key and api_key != "YOUR_GEMINI_API_KEY_HERE":
            self.client = genai.Client(api_key=api_key)
            print("Gemini client initialized")
        else:
            print("Warning: Gemini API key not configured; set GEMINI_API_KEY or provide secrets/gemini_api_key.txt")

    def _get_generation_config(
        self,
        model: ModelType,
        aspect_ratio: Optional[AspectRatio] = None,
        thinking_level: ThinkingLevel = ThinkingLevel.HIGH
    ) -> types.GenerateContentConfig:
        """Build generation config based on model and parameters."""
        config_dict = {
            "response_modalities": ["IMAGE", "TEXT"],
        }

        # Add aspect ratio for image generation models
        if aspect_ratio and model in [ModelType.GEMINI_25_FLASH_IMAGE, ModelType.GEMINI_3_PRO_IMAGE]:
            # Note: Aspect ratio is typically handled via prompt or specific parameters
            pass

        return types.GenerateContentConfig(**config_dict)

    def _extract_token_usage(self, response) -> TokenUsage:
        """Extract token usage from response."""
        try:
            usage = response.usage_metadata
            return TokenUsage(
                input_tokens=usage.prompt_token_count or 0,
                output_tokens=usage.candidates_token_count or 0,
                total_tokens=usage.total_token_count or 0
            )
        except Exception:
            return TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0)

    def _process_response(
        self,
        response,
        model: str,
        input_images: int = 0
    ) -> Tuple[Optional[str], Optional[str], TokenUsage, CostEstimate]:
        """Process Gemini response and extract image/text."""
        image_base64 = None
        text_response = None

        try:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    # Image response
                    image_bytes = part.inline_data.data
                    image_base64 = bytes_to_base64(image_bytes)
                elif hasattr(part, 'text') and part.text:
                    # Text response
                    text_response = part.text
        except Exception as e:
            text_response = f"Error processing response: {str(e)}"

        token_usage = self._extract_token_usage(response)
        cost_estimate = calculate_cost(
            model=model,
            input_tokens=token_usage.input_tokens,
            output_tokens=token_usage.output_tokens,
            input_images=input_images,
            output_images=1 if image_base64 else 0
        )

        return image_base64, text_response, token_usage, cost_estimate

    async def generate_image(
        self,
        prompt: str,
        model: ModelType = ModelType.GEMINI_25_FLASH_IMAGE,
        aspect_ratio: AspectRatio = AspectRatio.SQUARE,
        image_size: ImageSize = ImageSize.SIZE_1K,
        style_prompt: Optional[str] = None,
        use_grounding: bool = False,
        thinking_level: ThinkingLevel = ThinkingLevel.HIGH
    ) -> GenerationResponse:
        """Generate an image from text prompt."""
        if not self.client:
            return GenerationResponse(success=False, error="Gemini API not configured")

        try:
            # Build the full prompt with style if provided
            full_prompt = prompt
            if style_prompt:
                full_prompt = f"{style_prompt}. {prompt}"

            # Add aspect ratio to prompt
            full_prompt = f"{full_prompt}. Aspect ratio: {aspect_ratio.value}"

            # Add size preference
            if image_size == ImageSize.SIZE_4K:
                full_prompt = f"{full_prompt}. Generate in 4K high resolution."
            elif image_size == ImageSize.SIZE_2K:
                full_prompt = f"{full_prompt}. Generate in 2K resolution."

            config = self._get_generation_config(model, aspect_ratio, thinking_level)

            # Add grounding if requested (for Gemini 3 Pro Image)
            tools = []
            if use_grounding and model == ModelType.GEMINI_3_PRO_IMAGE:
                tools.append(types.Tool(google_search=types.GoogleSearch()))

            response = self.client.models.generate_content(
                model=model.value,
                contents=full_prompt,
                config=config,
            )

            image_base64, text_response, token_usage, cost_estimate = self._process_response(
                response, model.value
            )

            return GenerationResponse(
                success=True,
                image_base64=image_base64,
                text_response=text_response,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return GenerationResponse(success=False, error=str(e))

    async def edit_image(
        self,
        prompt: str,
        image_data: str,
        model: ModelType = ModelType.GEMINI_25_FLASH_IMAGE,
        mask_data: Optional[str] = None,
        style_prompt: Optional[str] = None,
        use_grounding: bool = False,
        thinking_level: ThinkingLevel = ThinkingLevel.HIGH
    ) -> GenerationResponse:
        """Edit an existing image with text prompt."""
        if not self.client:
            return GenerationResponse(success=False, error="Gemini API not configured")

        try:
            # Prepare the image
            image_bytes = base64_to_bytes(image_data)

            # Build the prompt
            full_prompt = prompt
            if style_prompt:
                full_prompt = f"{style_prompt}. {prompt}"

            if mask_data:
                full_prompt = f"{full_prompt}. Apply changes only to the masked area."

            # Build content parts
            contents = [
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                full_prompt
            ]

            # Add mask if provided
            if mask_data:
                mask_bytes = base64_to_bytes(mask_data)
                contents.insert(1, types.Part.from_bytes(data=mask_bytes, mime_type="image/png"))

            config = self._get_generation_config(model, thinking_level=thinking_level)

            response = self.client.models.generate_content(
                model=model.value,
                contents=contents,
                config=config,
            )

            input_images = 2 if mask_data else 1
            image_base64, text_response, token_usage, cost_estimate = self._process_response(
                response, model.value, input_images=input_images
            )

            return GenerationResponse(
                success=True,
                image_base64=image_base64,
                text_response=text_response,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return GenerationResponse(success=False, error=str(e))

    async def multi_image_edit(
        self,
        prompt: str,
        images: List[str],
        model: ModelType = ModelType.GEMINI_3_PRO_IMAGE,
        style_prompt: Optional[str] = None,
        use_grounding: bool = False,
        thinking_level: ThinkingLevel = ThinkingLevel.HIGH
    ) -> GenerationResponse:
        """Edit/compose multiple images (up to 14 for Gemini 3 Pro)."""
        if not self.client:
            return GenerationResponse(success=False, error="Gemini API not configured")

        if len(images) > 14:
            return GenerationResponse(success=False, error="Maximum 14 images supported")

        try:
            # Build content parts with all images
            contents = []
            for img_data in images:
                image_bytes = base64_to_bytes(img_data)
                contents.append(types.Part.from_bytes(data=image_bytes, mime_type="image/png"))

            # Add prompt
            full_prompt = prompt
            if style_prompt:
                full_prompt = f"{style_prompt}. {prompt}"
            contents.append(full_prompt)

            config = self._get_generation_config(model, thinking_level=thinking_level)

            response = self.client.models.generate_content(
                model=model.value,
                contents=contents,
                config=config,
            )

            image_base64, text_response, token_usage, cost_estimate = self._process_response(
                response, model.value, input_images=len(images)
            )

            return GenerationResponse(
                success=True,
                image_base64=image_base64,
                text_response=text_response,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return GenerationResponse(success=False, error=str(e))

    async def style_transfer(
        self,
        image_data: str,
        style_reference: str,
        prompt: str,
        model: ModelType = ModelType.GEMINI_3_PRO_IMAGE,
        style_strength: float = 0.7
    ) -> GenerationResponse:
        """Apply style from reference image to source image."""
        if not self.client:
            return GenerationResponse(success=False, error="Gemini API not configured")

        try:
            source_bytes = base64_to_bytes(image_data)
            style_bytes = base64_to_bytes(style_reference)

            style_instruction = f"Apply the artistic style from the second image to the first image with {int(style_strength * 100)}% style intensity. {prompt}"

            contents = [
                types.Part.from_bytes(data=source_bytes, mime_type="image/png"),
                types.Part.from_bytes(data=style_bytes, mime_type="image/png"),
                style_instruction
            ]

            config = self._get_generation_config(model)

            response = self.client.models.generate_content(
                model=model.value,
                contents=contents,
                config=config,
            )

            image_base64, text_response, token_usage, cost_estimate = self._process_response(
                response, model.value, input_images=2
            )

            return GenerationResponse(
                success=True,
                image_base64=image_base64,
                text_response=text_response,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return GenerationResponse(success=False, error=str(e))

    async def inpaint(
        self,
        image_data: str,
        mask_data: str,
        prompt: str,
        model: ModelType = ModelType.GEMINI_3_PRO_IMAGE,
        preserve_background: bool = True
    ) -> GenerationResponse:
        """Inpaint masked area of image."""
        if not self.client:
            return GenerationResponse(success=False, error="Gemini API not configured")

        try:
            image_bytes = base64_to_bytes(image_data)
            mask_bytes = base64_to_bytes(mask_data)

            inpaint_instruction = f"The second image is a mask where white areas should be filled/replaced. {prompt}"
            if preserve_background:
                inpaint_instruction += " Preserve the unmasked areas exactly as they are."

            contents = [
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                types.Part.from_bytes(data=mask_bytes, mime_type="image/png"),
                inpaint_instruction
            ]

            config = self._get_generation_config(model)

            response = self.client.models.generate_content(
                model=model.value,
                contents=contents,
                config=config,
            )

            image_base64, text_response, token_usage, cost_estimate = self._process_response(
                response, model.value, input_images=2
            )

            return GenerationResponse(
                success=True,
                image_base64=image_base64,
                text_response=text_response,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return GenerationResponse(success=False, error=str(e))

    def _parse_json_from_markdown(self, text: str) -> str:
        """Parse JSON from markdown-fenced response (```json ... ```)."""
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if line.strip() == "```json":
                # Remove everything before "```json"
                json_output = "\n".join(lines[i + 1:])
                # Remove everything after the closing "```"
                if "```" in json_output:
                    json_output = json_output.split("```")[0]
                return json_output
        # No markdown fencing found, return as-is
        return text

    async def segment_objects(
        self,
        image_data: str,
        prompt: str = "Detect and segment all objects in the image",
        model: ModelType = ModelType.GEMINI_3_FLASH,
        media_resolution: MediaResolution = MediaResolution.HIGH
    ) -> SegmentationResponse:
        """Perform semantic segmentation using Gemini's native segmentation capability.
        
        Based on Gemini documentation - returns actual PNG mask images as base64 in JSON.
        """
        if not self.client:
            return SegmentationResponse(success=False, error="Gemini API not configured")

        try:
            # Load and resize image following documentation pattern
            im = base64_to_image(image_data)
            im.thumbnail([1024, 1024], Image.Resampling.LANCZOS)

            # Segmentation prompt following Gemini documentation exactly
            segmentation_prompt = f"""{prompt}

Output a JSON list of segmentation masks where each entry contains the 2D bounding box in the key "box_2d", the segmentation mask in key "mask", and the text label in the key "label". Use descriptive labels."""

            contents = [
                segmentation_prompt,
                im  # Pass PIL image directly - SDK converts it
            ]

            # Simple config - no ThinkingConfig in older SDK versions
            print(f"=== SEGMENTATION API CALL ===")
            print(f"Model: {model.value}")
            print(f"Prompt: {segmentation_prompt[:100]}...")
            print(f"Image size: {im.size}")
            
            response = self.client.models.generate_content(
                model=model.value,
                contents=contents,
            )

            token_usage = self._extract_token_usage(response)
            cost_estimate = calculate_cost(
                model=model.value,
                input_tokens=token_usage.input_tokens,
                output_tokens=token_usage.output_tokens,
                input_images=1
            )

            # Parse JSON from response.text following documentation
            segments = []
            
            try:
                # Get JSON from response - may be markdown-fenced
                json_text = self._parse_json_from_markdown(response.text)
                
                # Debug: print raw response to see what we're getting
                print(f"=== SEGMENTATION DEBUG ===")
                print(f"Raw response text (first 1000 chars):\n{response.text[:1000]}")
                print(f"Parsed JSON text (first 500 chars):\n{json_text[:500]}")
                
                items = json.loads(json_text)
                
                # Handle single object response
                if isinstance(items, dict):
                    items = [items]
                
                print(f"Segmentation: found {len(items)} segments in response")
                
                # Debug: print each item's keys
                for i, item in enumerate(items):
                    print(f"  Item {i} keys: {list(item.keys())}")
                    mask_val = item.get('mask', 'NOT_PRESENT')
                    if isinstance(mask_val, str):
                        print(f"  Item {i} mask: {mask_val[:100] if len(mask_val) > 100 else mask_val}...")
                    else:
                        print(f"  Item {i} mask type: {type(mask_val)}, value: {mask_val}")
                
                # Get image dimensions for fallback
                orig_width, orig_height = im.size
                
                # Process each segment following documentation pattern
                for i, item in enumerate(items):
                    # Get bounding box - [y_min, x_min, y_max, x_max] normalized to 0-1000
                    box = item.get("box_2d") or item.get("box", [0, 0, 1000, 1000])
                    label = item.get("label", f"object_{i}")
                    
                    # Get mask - comes as "data:image/png;base64,..." in the JSON
                    mask_base64 = ""
                    png_str = item.get("mask", "")
                    raw_mask_base64 = ""
                    
                    if isinstance(png_str, str) and png_str:
                        if png_str.startswith("data:image/png;base64,"):
                            # Remove prefix per documentation
                            raw_mask_base64 = png_str.removeprefix("data:image/png;base64,")
                            print(f"  {label}: extracted actual mask from base64")
                        else:
                            # Already just base64
                            raw_mask_base64 = png_str
                            print(f"  {label}: using provided mask")
                    
                    # If we have a raw mask, expand it to full image size
                    if raw_mask_base64:
                        try:
                            mask_base64 = expand_mask_to_full_image(
                                raw_mask_base64, orig_width, orig_height, box
                            )
                            print(f"  {label}: expanded mask to full image size ({orig_width}x{orig_height})")
                        except Exception as mask_err:
                            print(f"  {label}: failed to expand mask: {mask_err}, using fallback")
                            mask_base64 = ""
                    
                    # Fallback: create mask from bounding box if no mask provided
                    if not mask_base64:
                        mask_base64 = create_mask_from_bounding_box(orig_width, orig_height, box)
                        print(f"  {label}: created fallback mask from bounding box")
                    
                    segments.append(SegmentationResult(
                        label=label,
                        box=box,
                        mask_base64=mask_base64
                    ))
                    
            except json.JSONDecodeError as json_err:
                print(f"Error parsing segmentation JSON: {json_err}")
                print(f"Raw response: {response.text[:500]}...")
            except Exception as parse_error:
                print(f"Error parsing segmentation response: {parse_error}")
                import traceback
                traceback.print_exc()

            return SegmentationResponse(
                success=True,
                segments=segments,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            import traceback
            traceback.print_exc()
            return SegmentationResponse(success=False, error=str(e))

    async def detect_objects(
        self,
        image_data: str,
        prompt: str = "Detect all prominent objects in the image",
        model: ModelType = ModelType.GEMINI_3_FLASH,
        media_resolution: MediaResolution = MediaResolution.HIGH
    ) -> ObjectDetectionResponse:
        """Detect objects and return bounding boxes."""
        if not self.client:
            return ObjectDetectionResponse(success=False, error="Gemini API not configured")

        try:
            image_bytes = base64_to_bytes(image_data)

            # Following Gemini documentation format
            detection_prompt = f"""{prompt}. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."""

            contents = [
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                detection_prompt
            ]

            # Use JSON response format per documentation
            config = types.GenerateContentConfig(
                response_mime_type="application/json"
            )

            response = self.client.models.generate_content(
                model=model.value,
                contents=contents,
                config=config,
            )

            token_usage = self._extract_token_usage(response)
            cost_estimate = calculate_cost(
                model=model.value,
                input_tokens=token_usage.input_tokens,
                output_tokens=token_usage.output_tokens,
                input_images=1
            )

            # Parse detection results
            objects = []
            try:
                text_response = response.candidates[0].content.parts[0].text
                # Parse JSON directly (response_mime_type ensures valid JSON)
                detection_data = json.loads(text_response)

                # Handle both array and single object
                if isinstance(detection_data, dict):
                    detection_data = [detection_data]

                for det in detection_data:
                    # Gemini returns box_2d per documentation
                    box = det.get("box_2d") or det.get("box", [0, 0, 1000, 1000])
                    objects.append(BoundingBox(
                        label=det.get("label", "object"),
                        box=box,
                        confidence=det.get("confidence")
                    ))
            except json.JSONDecodeError:
                # Fallback: try to extract JSON from text
                json_match = re.search(r'\[[\s\S]*?\]', text_response)
                if json_match:
                    detection_data = json.loads(json_match.group())
                    for det in detection_data:
                        box = det.get("box_2d") or det.get("box", [0, 0, 1000, 1000])
                        objects.append(BoundingBox(
                            label=det.get("label", "object"),
                            box=box,
                            confidence=det.get("confidence")
                        ))
            except Exception as parse_error:
                print(f"Error parsing detection response: {parse_error}")

            return ObjectDetectionResponse(
                success=True,
                objects=objects,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return ObjectDetectionResponse(success=False, error=str(e))

    async def understand_image(
        self,
        image_data: str,
        prompt: str,
        model: ModelType = ModelType.GEMINI_3_FLASH,
        media_resolution: MediaResolution = MediaResolution.HIGH
    ) -> GenerationResponse:
        """General image understanding - captioning, VQA, analysis."""
        if not self.client:
            return GenerationResponse(success=False, error="Gemini API not configured")

        try:
            image_bytes = base64_to_bytes(image_data)

            contents = [
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                prompt
            ]

            config = types.GenerateContentConfig()

            response = self.client.models.generate_content(
                model=model.value,
                contents=contents,
                config=config,
            )

            token_usage = self._extract_token_usage(response)
            cost_estimate = calculate_cost(
                model=model.value,
                input_tokens=token_usage.input_tokens,
                output_tokens=token_usage.output_tokens,
                input_images=1
            )

            text_response = None
            try:
                text_response = response.candidates[0].content.parts[0].text
            except Exception:
                pass

            return GenerationResponse(
                success=True,
                text_response=text_response,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return GenerationResponse(success=False, error=str(e))

    async def assist_prompt(
        self,
        context: str,
        task_type: str,
        model: ModelType = ModelType.GEMINI_3_PRO
    ) -> GenerationResponse:
        """Use LLM to help create better prompts."""
        if not self.client:
            return GenerationResponse(success=False, error="Gemini API not configured")

        try:
            prompt_templates = {
                "generate": """You are an expert at creating image generation prompts.
                    Based on the user's description, create a detailed, effective prompt for AI image generation.
                    Include: subject, style, lighting, composition, mood, and technical details.
                    User's idea: {context}

                    Provide the optimized prompt only, no explanation.""",

                "edit": """You are an expert at creating image editing prompts.
                    Based on the user's editing request, create a clear, specific prompt for AI image editing.
                    Be precise about what should change and what should be preserved.
                    User's request: {context}

                    Provide the optimized editing prompt only, no explanation.""",

                "style": """You are an expert at describing artistic styles.
                    Based on the user's style description, create a detailed style prompt that can be applied to any image.
                    Include: artistic technique, color palette, texture, mood, and reference artists if applicable.
                    User's style idea: {context}

                    Provide the style prompt only, no explanation.""",

                "segmentation": """You are an expert at object detection and segmentation.
                    Based on the user's request, create a precise prompt for identifying and segmenting objects in an image.
                    Be specific about what objects to find and how to identify them.
                    User's request: {context}

                    Provide the segmentation prompt only, no explanation."""
            }

            template = prompt_templates.get(task_type, prompt_templates["generate"])
            full_prompt = template.format(context=context)

            config = types.GenerateContentConfig()

            response = self.client.models.generate_content(
                model=model.value,
                contents=full_prompt,
                config=config,
            )

            token_usage = self._extract_token_usage(response)
            cost_estimate = calculate_cost(
                model=model.value,
                input_tokens=token_usage.input_tokens,
                output_tokens=token_usage.output_tokens
            )

            text_response = None
            try:
                text_response = response.candidates[0].content.parts[0].text
            except Exception:
                pass

            return GenerationResponse(
                success=True,
                text_response=text_response,
                token_usage=token_usage,
                cost_estimate=cost_estimate
            )

        except Exception as e:
            return GenerationResponse(success=False, error=str(e))


# Global service instance
gemini_service = GeminiService()
