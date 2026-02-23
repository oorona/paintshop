from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
import json
from pathlib import Path

from ..models.schemas import Style, PromptTemplate, PromptAssistRequest, GenerationResponse
from ..services.gemini_service import gemini_service
from ..services.session_service import session_service

router = APIRouter(prefix="/api", tags=["Styles & Templates"])

# Predefined styles - 32 styles across categories
PREDEFINED_STYLES: List[Style] = [
    # Photography (1-8)
    Style(
        id="cinematic-film",
        name="Cinematic Film",
        category="Photography",
        prompt_template="Shot in cinematic film style with dramatic lighting, shallow depth of field, anamorphic lens flare, rich color grading like a Hollywood movie",
        description="Dramatic movie-like visuals with professional cinematography",
        example_prompt="A warrior standing on a cliff at sunset, cinematic film style",
        tags=["dramatic", "movie", "professional"]
    ),
    Style(
        id="portrait-studio",
        name="Portrait Studio",
        category="Photography",
        prompt_template="Professional studio portrait photography with soft key lighting, clean background, sharp focus on subject, subtle rim lighting, high-end fashion magazine quality",
        description="Professional headshot/portrait lighting",
        example_prompt="A business executive, professional portrait studio style",
        tags=["portrait", "professional", "studio"]
    ),
    Style(
        id="street-photography",
        name="Street Photography",
        category="Photography",
        prompt_template="Candid street photography style, natural lighting, urban environment, documentary feel, slightly grainy, authentic moment captured",
        description="Candid urban moments",
        example_prompt="A musician playing saxophone on a rainy street corner, street photography style",
        tags=["candid", "urban", "documentary"]
    ),
    Style(
        id="landscape-epic",
        name="Landscape Epic",
        category="Photography",
        prompt_template="Epic landscape photography, golden hour lighting, sweeping vista, dramatic clouds, HDR quality, deep depth of field, National Geographic style",
        description="Sweeping vistas, golden hour",
        example_prompt="Mountain range with a lake at golden hour, epic landscape style",
        tags=["landscape", "nature", "epic"]
    ),
    Style(
        id="macro-detail",
        name="Macro Detail",
        category="Photography",
        prompt_template="Extreme macro photography, incredible detail, shallow depth of field, bokeh background, crisp focus on subject, revealing hidden textures",
        description="Extreme close-up, sharp focus",
        example_prompt="A dewdrop on a spider web, macro detail style",
        tags=["macro", "detail", "close-up"]
    ),
    Style(
        id="vintage-film",
        name="Vintage Film",
        category="Photography",
        prompt_template="Vintage 35mm film photography, slight grain, faded colors, light leaks, nostalgic warm tones, vignette, 1970s aesthetic",
        description="Grain, faded colors, light leaks",
        example_prompt="A classic car at a diner, vintage film style",
        tags=["vintage", "retro", "nostalgic"]
    ),
    Style(
        id="high-fashion",
        name="High Fashion",
        category="Photography",
        prompt_template="High fashion editorial photography, dramatic poses, studio lighting, bold contrasts, Vogue magazine quality, avant-garde styling",
        description="Editorial, dramatic poses",
        example_prompt="A model in an avant-garde dress, high fashion style",
        tags=["fashion", "editorial", "glamour"]
    ),
    Style(
        id="documentary",
        name="Documentary",
        category="Photography",
        prompt_template="Raw documentary photography, authentic moments, natural lighting, photojournalistic style, telling a story, unposed and genuine",
        description="Raw, authentic moments",
        example_prompt="Workers in a traditional market, documentary style",
        tags=["documentary", "authentic", "storytelling"]
    ),

    # Digital Art (9-16)
    Style(
        id="concept-art",
        name="Concept Art",
        category="Digital Art",
        prompt_template="Professional concept art for game/film production, detailed environment or character design, dynamic composition, painterly strokes, industry standard quality",
        description="Game/film production style",
        example_prompt="A futuristic city with flying vehicles, concept art style",
        tags=["concept", "game", "film"]
    ),
    Style(
        id="digital-painting",
        name="Digital Painting",
        category="Digital Art",
        prompt_template="Digital painting with visible brushstroke textures, rich colors, artistic interpretation, blending of traditional painting techniques with digital medium",
        description="Brushstroke textures",
        example_prompt="A forest spirit emerging from ancient trees, digital painting style",
        tags=["painting", "artistic", "textured"]
    ),
    Style(
        id="3d-render",
        name="3D Render",
        category="Digital Art",
        prompt_template="Clean photorealistic 3D render, ray-traced lighting, subsurface scattering, ambient occlusion, studio lighting setup, Octane/Blender quality",
        description="Clean, photorealistic CGI",
        example_prompt="A sleek product design on a pedestal, 3D render style",
        tags=["3d", "render", "photorealistic"]
    ),
    Style(
        id="low-poly",
        name="Low Poly",
        category="Digital Art",
        prompt_template="Low poly 3D art style, geometric shapes, flat shading, minimalist aesthetic, vibrant colors, modern design",
        description="Geometric minimalism",
        example_prompt="A low poly fox in a geometric forest, low poly style",
        tags=["lowpoly", "geometric", "minimalist"]
    ),
    Style(
        id="voxel-art",
        name="Voxel Art",
        category="Digital Art",
        prompt_template="Voxel art style, blocky 3D pixels, Minecraft-like aesthetic, colorful cubic shapes, charming and playful",
        description="Blocky 3D pixels",
        example_prompt="A medieval castle made of voxels, voxel art style",
        tags=["voxel", "blocky", "playful"]
    ),
    Style(
        id="isometric",
        name="Isometric",
        category="Digital Art",
        prompt_template="Isometric perspective illustration, 30-degree angle, clean lines, detailed miniature world, diorama-like quality, no perspective distortion",
        description="Angled perspective",
        example_prompt="An isometric coffee shop interior, isometric style",
        tags=["isometric", "perspective", "miniature"]
    ),
    Style(
        id="pixel-art",
        name="Pixel Art",
        category="Digital Art",
        prompt_template="Retro pixel art, 8-bit or 16-bit aesthetic, limited color palette, nostalgic video game style, crisp pixels, no anti-aliasing",
        description="Retro 8/16-bit",
        example_prompt="A pixel art hero with a sword, 16-bit style",
        tags=["pixel", "retro", "gaming"]
    ),
    Style(
        id="vector-illustration",
        name="Vector Illustration",
        category="Digital Art",
        prompt_template="Clean vector illustration, flat colors, bold outlines, minimalist design, scalable graphics, modern corporate style",
        description="Clean lines, flat colors",
        example_prompt="A vector illustration of a startup team, vector style",
        tags=["vector", "flat", "modern"]
    ),

    # Traditional Art (17-24)
    Style(
        id="oil-painting",
        name="Oil Painting",
        category="Traditional Art",
        prompt_template="Classical oil painting technique, rich impasto texture, masterful brushwork, Renaissance color palette, museum quality, reminiscent of old masters",
        description="Classical technique",
        example_prompt="A noble portrait in classical oil painting style",
        tags=["oil", "classical", "traditional"]
    ),
    Style(
        id="watercolor",
        name="Watercolor",
        category="Traditional Art",
        prompt_template="Delicate watercolor painting, soft flowing pigments, visible paper texture, gentle color bleeds, transparent washes, dreamy aesthetic",
        description="Soft, flowing pigments",
        example_prompt="A botanical illustration of flowers, watercolor style",
        tags=["watercolor", "soft", "dreamy"]
    ),
    Style(
        id="pencil-sketch",
        name="Pencil Sketch",
        category="Traditional Art",
        prompt_template="Detailed graphite pencil sketch, varied line weights, subtle shading, crosshatching technique, sketchbook quality, raw artistic expression",
        description="Graphite textures",
        example_prompt="A pencil sketch of an old building, detailed graphite style",
        tags=["pencil", "sketch", "graphite"]
    ),
    Style(
        id="charcoal-drawing",
        name="Charcoal Drawing",
        category="Traditional Art",
        prompt_template="Bold charcoal drawing, strong contrasts, expressive marks, smudged shadows, dramatic black and white, raw emotional power",
        description="Bold, expressive",
        example_prompt="A charcoal portrait of a jazz musician, expressive style",
        tags=["charcoal", "bold", "expressive"]
    ),
    Style(
        id="ink-wash",
        name="Ink Wash",
        category="Traditional Art",
        prompt_template="Traditional East Asian ink wash painting, sumi-e technique, zen aesthetic, minimal strokes, negative space, meditative quality, rice paper texture",
        description="Asian brush painting",
        example_prompt="A mountain landscape in ink wash style, zen aesthetic",
        tags=["ink", "asian", "zen"]
    ),
    Style(
        id="pastel",
        name="Pastel",
        category="Traditional Art",
        prompt_template="Soft pastel artwork, chalky texture, blended colors, impressionistic quality, gentle gradients, romantic atmosphere",
        description="Soft, chalky texture",
        example_prompt="A sunset beach scene in soft pastel style",
        tags=["pastel", "soft", "romantic"]
    ),
    Style(
        id="gouache",
        name="Gouache",
        category="Traditional Art",
        prompt_template="Gouache painting style, opaque watercolor, matte finish, bold flat colors, vintage illustration quality, mid-century modern aesthetic",
        description="Opaque watercolor",
        example_prompt="A vintage travel poster in gouache style",
        tags=["gouache", "vintage", "illustration"]
    ),
    Style(
        id="impressionist",
        name="Impressionist",
        category="Traditional Art",
        prompt_template="French Impressionist painting style, visible brushstrokes, light and color focus, en plein air quality, Monet and Renoir inspired, capturing fleeting moments",
        description="Light and color focus",
        example_prompt="A garden party scene, French Impressionist style",
        tags=["impressionist", "light", "artistic"]
    ),

    # Stylized (25-32)
    Style(
        id="anime-manga",
        name="Anime/Manga",
        category="Stylized",
        prompt_template="Japanese anime/manga art style, large expressive eyes, dynamic poses, speed lines, cel-shaded colors, Studio Ghibli or shonen quality",
        description="Japanese animation",
        example_prompt="An anime hero with wind-swept hair, manga style",
        tags=["anime", "manga", "japanese"]
    ),
    Style(
        id="comic-book",
        name="Comic Book",
        category="Stylized",
        prompt_template="American comic book art style, bold ink outlines, halftone dots, dynamic action poses, speech bubbles ready, Marvel/DC quality",
        description="Bold lines, halftone",
        example_prompt="A superhero flying over a city, comic book style",
        tags=["comic", "superhero", "action"]
    ),
    Style(
        id="chibi",
        name="Chibi",
        category="Stylized",
        prompt_template="Cute chibi art style, exaggerated small body with large head, adorable expressions, kawaii aesthetic, simplified features, maximum cuteness",
        description="Cute, exaggerated proportions",
        example_prompt="A chibi wizard casting a spell, kawaii style",
        tags=["chibi", "cute", "kawaii"]
    ),
    Style(
        id="art-nouveau",
        name="Art Nouveau",
        category="Stylized",
        prompt_template="Art Nouveau decorative style, organic flowing curves, nature-inspired motifs, ornate borders, Alphonse Mucha inspired, elegant and feminine",
        description="Organic curves, ornate",
        example_prompt="A woman surrounded by flowers, Art Nouveau style",
        tags=["artnouveau", "decorative", "elegant"]
    ),
    Style(
        id="art-deco",
        name="Art Deco",
        category="Stylized",
        prompt_template="Art Deco design style, geometric patterns, bold symmetry, luxurious gold and black, 1920s glamour, Gatsby era aesthetic",
        description="Geometric, luxurious",
        example_prompt="A grand ballroom entrance, Art Deco style",
        tags=["artdeco", "geometric", "luxury"]
    ),
    Style(
        id="cyberpunk",
        name="Cyberpunk",
        category="Stylized",
        prompt_template="Cyberpunk aesthetic, neon-lit dystopian future, rain-slicked streets, holographic advertisements, tech noir atmosphere, Blade Runner inspired",
        description="Neon, dystopian future",
        example_prompt="A hacker in a neon-lit alley, cyberpunk style",
        tags=["cyberpunk", "neon", "scifi"]
    ),
    Style(
        id="steampunk",
        name="Steampunk",
        category="Stylized",
        prompt_template="Steampunk aesthetic, Victorian era meets industrial machinery, brass gears and cogs, steam-powered devices, goggles and leather, retro-futuristic",
        description="Victorian + machinery",
        example_prompt="An inventor in their workshop, steampunk style",
        tags=["steampunk", "victorian", "industrial"]
    ),
    Style(
        id="fantasy-epic",
        name="Fantasy Epic",
        category="Stylized",
        prompt_template="Epic fantasy art style, dragons and magic, medieval castles, heroic warriors, ethereal lighting, Lord of the Rings quality, mythical and majestic",
        description="Dragons, magic, medieval",
        example_prompt="A dragon perched on a mountain fortress, epic fantasy style",
        tags=["fantasy", "epic", "magical"]
    ),
]

# Custom styles storage (in-memory, would be persisted in production)
custom_styles: Dict[str, Style] = {}

# Predefined prompt templates
PREDEFINED_TEMPLATES: List[PromptTemplate] = [
    # Generation templates
    PromptTemplate(
        id="character-portrait",
        name="Character Portrait",
        category="Generation",
        template="A {age} {gender} {occupation}, with {expression} expression, {lighting} lighting, {style} style",
        variables=["age", "gender", "occupation", "expression", "lighting", "style"],
        description="Create detailed character portraits",
        example_filled="A young female astronaut, with determined expression, dramatic rim lighting, cinematic style"
    ),
    PromptTemplate(
        id="environment-scene",
        name="Environment Scene",
        category="Generation",
        template="{time_of_day} at a {location}, {atmosphere} atmosphere, {weather} weather, {style} style",
        variables=["time_of_day", "location", "atmosphere", "weather", "style"],
        description="Create immersive environment scenes",
        example_filled="Golden hour at a Japanese temple, peaceful atmosphere, light fog weather, watercolor style"
    ),
    PromptTemplate(
        id="product-showcase",
        name="Product Showcase",
        category="Generation",
        template="A {material} {product} with {details}, on a {background} background, {lighting} lighting",
        variables=["material", "product", "details", "background", "lighting"],
        description="Product photography and renders",
        example_filled="A brushed aluminum smartwatch with leather strap, on a marble background, soft studio lighting"
    ),
    PromptTemplate(
        id="creature-design",
        name="Creature Design",
        category="Generation",
        template="A {size} {creature_type} with {features}, in a {habitat} environment, {mood} mood, {style} style",
        variables=["size", "creature_type", "features", "habitat", "mood", "style"],
        description="Design fantasy or sci-fi creatures",
        example_filled="A massive dragon with crystalline scales, in a volcanic environment, menacing mood, concept art style"
    ),

    # Editing templates
    PromptTemplate(
        id="background-change",
        name="Change Background",
        category="Editing",
        template="Replace the background with {new_background}, while perfectly preserving the main subject",
        variables=["new_background"],
        description="Swap backgrounds while keeping subject",
        example_filled="Replace the background with a tropical beach at sunset, while perfectly preserving the main subject"
    ),
    PromptTemplate(
        id="style-transform",
        name="Style Transform",
        category="Editing",
        template="Transform this image into {target_style} style while preserving the composition and subject",
        variables=["target_style"],
        description="Apply artistic style transformation",
        example_filled="Transform this image into Van Gogh starry night style while preserving the composition and subject"
    ),
    PromptTemplate(
        id="add-element",
        name="Add Element",
        category="Editing",
        template="Add {element} to the {position} of the image, seamlessly blending with existing content",
        variables=["element", "position"],
        description="Add new elements to images",
        example_filled="Add a rainbow to the sky of the image, seamlessly blending with existing content"
    ),
    PromptTemplate(
        id="outfit-change",
        name="Change Outfit",
        category="Editing",
        template="Change the subject's outfit to {new_outfit}, maintaining the same pose and expression",
        variables=["new_outfit"],
        description="Swap clothing on subjects",
        example_filled="Change the subject's outfit to a formal black tuxedo, maintaining the same pose and expression"
    ),

    # Segmentation templates
    PromptTemplate(
        id="extract-subject",
        name="Extract Subject",
        category="Segmentation",
        template="Identify and segment the {subject} from the image with precise boundaries",
        variables=["subject"],
        description="Extract specific subjects with masks",
        example_filled="Identify and segment the dog from the image with precise boundaries"
    ),
    PromptTemplate(
        id="multi-object-segment",
        name="Multi-Object Segment",
        category="Segmentation",
        template="Identify and segment all {category} objects in the scene with individual masks",
        variables=["category"],
        description="Segment multiple objects by category",
        example_filled="Identify and segment all vehicle objects in the scene with individual masks"
    ),

    # Pet workflow templates (as requested)
    PromptTemplate(
        id="pet-costume",
        name="Pet Costume",
        category="Workflow",
        template="Transform this pet into a {costume} costume, maintaining the pet's features and expression, {style} style",
        variables=["costume", "style"],
        description="Add costumes to pet photos",
        example_filled="Transform this pet into a pirate costume, maintaining the pet's features and expression, chibi style"
    ),
    PromptTemplate(
        id="pet-scene",
        name="Pet in Scene",
        category="Workflow",
        template="Place this pet in a {scene} setting, as if they belong there naturally, {lighting} lighting",
        variables=["scene", "lighting"],
        description="Place pets in new environments",
        example_filled="Place this pet in a medieval castle throne room setting, as if they belong there naturally, dramatic lighting"
    ),
]

# Custom templates storage
custom_templates: Dict[str, PromptTemplate] = {}


def get_style_prompt(style_id: str) -> Optional[str]:
    """Get prompt template for a style by ID."""
    # Check predefined styles
    for style in PREDEFINED_STYLES:
        if style.id == style_id:
            return style.prompt_template
    # Check custom styles
    if style_id in custom_styles:
        return custom_styles[style_id].prompt_template
    return None


@router.get("/styles", response_model=List[Style])
async def list_styles(category: Optional[str] = None):
    """List all available styles."""
    all_styles = PREDEFINED_STYLES + list(custom_styles.values())
    if category:
        return [s for s in all_styles if s.category.lower() == category.lower()]
    return all_styles


@router.get("/styles/categories")
async def list_style_categories():
    """List all style categories."""
    categories = set()
    for style in PREDEFINED_STYLES:
        categories.add(style.category)
    return sorted(list(categories))


@router.get("/styles/{style_id}", response_model=Style)
async def get_style(style_id: str):
    """Get a specific style by ID."""
    for style in PREDEFINED_STYLES:
        if style.id == style_id:
            return style
    if style_id in custom_styles:
        return custom_styles[style_id]
    raise HTTPException(status_code=404, detail="Style not found")


@router.post("/styles", response_model=Style)
async def create_style(style: Style):
    """Create a custom style."""
    if style.id in custom_styles or any(s.id == style.id for s in PREDEFINED_STYLES):
        raise HTTPException(status_code=400, detail="Style ID already exists")
    custom_styles[style.id] = style
    return style


@router.delete("/styles/{style_id}")
async def delete_style(style_id: str):
    """Delete a custom style."""
    if style_id in custom_styles:
        del custom_styles[style_id]
        return {"message": "Style deleted"}
    if any(s.id == style_id for s in PREDEFINED_STYLES):
        raise HTTPException(status_code=400, detail="Cannot delete predefined styles")
    raise HTTPException(status_code=404, detail="Style not found")


@router.get("/prompts", response_model=List[PromptTemplate])
async def list_prompt_templates(category: Optional[str] = None):
    """List all prompt templates."""
    all_templates = PREDEFINED_TEMPLATES + list(custom_templates.values())
    if category:
        return [t for t in all_templates if t.category.lower() == category.lower()]
    return all_templates


@router.get("/prompts/categories")
async def list_template_categories():
    """List all template categories."""
    categories = set()
    for template in PREDEFINED_TEMPLATES:
        categories.add(template.category)
    return sorted(list(categories))


@router.get("/prompts/{template_id}", response_model=PromptTemplate)
async def get_template(template_id: str):
    """Get a specific prompt template by ID."""
    for template in PREDEFINED_TEMPLATES:
        if template.id == template_id:
            return template
    if template_id in custom_templates:
        return custom_templates[template_id]
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/prompts", response_model=PromptTemplate)
async def create_template(template: PromptTemplate):
    """Create a custom prompt template."""
    if template.id in custom_templates or any(t.id == template.id for t in PREDEFINED_TEMPLATES):
        raise HTTPException(status_code=400, detail="Template ID already exists")
    custom_templates[template.id] = template
    return template


@router.delete("/prompts/{template_id}")
async def delete_template(template_id: str):
    """Delete a custom prompt template."""
    if template_id in custom_templates:
        del custom_templates[template_id]
        return {"message": "Template deleted"}
    if any(t.id == template_id for t in PREDEFINED_TEMPLATES):
        raise HTTPException(status_code=400, detail="Cannot delete predefined templates")
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/prompt/assist", response_model=GenerationResponse)
async def assist_prompt(request: PromptAssistRequest):
    """Use LLM to help create better prompts."""
    result = await gemini_service.assist_prompt(
        context=request.context,
        task_type=request.task_type,
        model=request.model
    )

    if result.success and result.token_usage and result.cost_estimate:
        session_id = session_service.get_or_create_session()
        session_service.record_request(
            session_id=session_id,
            request_type="prompt_assist",
            token_usage=result.token_usage,
            cost_estimate=result.cost_estimate,
            model=request.model.value,
            prompt=request.context
        )

    return result


@router.post("/prompt/fill")
async def fill_template(template_id: str, variables: Dict[str, str]):
    """Fill a prompt template with provided variables."""
    template = None
    for t in PREDEFINED_TEMPLATES:
        if t.id == template_id:
            template = t
            break
    if not template and template_id in custom_templates:
        template = custom_templates[template_id]

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    filled_prompt = template.template
    for var, value in variables.items():
        filled_prompt = filled_prompt.replace(f"{{{var}}}", value)

    return {"filled_prompt": filled_prompt, "template_id": template_id}
