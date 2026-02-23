from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import json
import uuid
import base64
import io
from datetime import datetime
from pathlib import Path
from PIL import Image

from ..models.schemas import Project, Layer
from ..utils.image_utils import (
    base64_to_image, image_to_base64, apply_mask_to_image,
    combine_masks, extract_with_mask, composite_images, base64_to_bytes
)

router = APIRouter(prefix="/api", tags=["Projects"])

# In-memory project storage (would be persisted in production)
projects: Dict[str, Project] = {}


def get_project_storage_path() -> Path:
    """Get the path for project storage."""
    path = Path("/app/sessions/projects")
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_project_to_file(project: Project):
    """Save project to file storage."""
    storage_path = get_project_storage_path()
    file_path = storage_path / f"{project.id}.json"
    with open(file_path, "w") as f:
        json.dump(project.model_dump(), f, indent=2, default=str)


def load_project_from_file(project_id: str) -> Optional[Project]:
    """Load project from file storage."""
    storage_path = get_project_storage_path()
    file_path = storage_path / f"{project_id}.json"
    if file_path.exists():
        with open(file_path, "r") as f:
            data = json.load(f)
            return Project(**data)
    return None


@router.post("/projects", response_model=Project)
async def create_project(name: str, width: int = 1024, height: int = 1024):
    """Create a new project."""
    project = Project(
        id=str(uuid.uuid4()),
        name=name,
        layers=[],
        width=width,
        height=height,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    projects[project.id] = project
    save_project_to_file(project)
    return project


@router.get("/projects", response_model=List[Dict[str, Any]])
async def list_projects():
    """List all projects."""
    result = []
    storage_path = get_project_storage_path()
    for file_path in storage_path.glob("*.json"):
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
                result.append({
                    "id": data["id"],
                    "name": data["name"],
                    "width": data["width"],
                    "height": data["height"],
                    "layer_count": len(data.get("layers", [])),
                    "created_at": data["created_at"],
                    "updated_at": data["updated_at"]
                })
        except Exception:
            continue
    return result


@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get a project by ID."""
    if project_id in projects:
        return projects[project_id]

    project = load_project_from_file(project_id)
    if project:
        projects[project_id] = project
        return project

    raise HTTPException(status_code=404, detail="Project not found")


@router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, name: Optional[str] = None, width: Optional[int] = None, height: Optional[int] = None):
    """Update project properties."""
    project = await get_project(project_id)

    if name:
        project.name = name
    if width:
        project.width = width
    if height:
        project.height = height

    project.updated_at = datetime.utcnow()
    save_project_to_file(project)

    return project


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    if project_id in projects:
        del projects[project_id]

    storage_path = get_project_storage_path()
    file_path = storage_path / f"{project_id}.json"
    if file_path.exists():
        file_path.unlink()
        return {"message": "Project deleted"}

    raise HTTPException(status_code=404, detail="Project not found")


# Layer operations

@router.post("/projects/{project_id}/layers", response_model=Layer)
async def add_layer(
    project_id: str,
    name: str,
    layer_type: str = "image",
    image_data: Optional[str] = None,
    order: Optional[int] = None
):
    """Add a new layer to the project."""
    project = await get_project(project_id)

    if order is None:
        order = len(project.layers)

    layer = Layer(
        id=str(uuid.uuid4()),
        name=name,
        type=layer_type,
        image_base64=image_data or "",
        visible=True,
        opacity=1.0,
        blend_mode="normal",
        order=order
    )

    project.layers.append(layer)
    project.layers.sort(key=lambda x: x.order)
    project.updated_at = datetime.utcnow()
    save_project_to_file(project)

    return layer


@router.get("/projects/{project_id}/layers", response_model=List[Layer])
async def list_layers(project_id: str):
    """List all layers in a project."""
    project = await get_project(project_id)
    return sorted(project.layers, key=lambda x: x.order)


@router.get("/projects/{project_id}/layers/{layer_id}", response_model=Layer)
async def get_layer(project_id: str, layer_id: str):
    """Get a specific layer."""
    project = await get_project(project_id)
    for layer in project.layers:
        if layer.id == layer_id:
            return layer
    raise HTTPException(status_code=404, detail="Layer not found")


@router.put("/projects/{project_id}/layers/{layer_id}", response_model=Layer)
async def update_layer(
    project_id: str,
    layer_id: str,
    name: Optional[str] = None,
    visible: Optional[bool] = None,
    opacity: Optional[float] = None,
    blend_mode: Optional[str] = None,
    order: Optional[int] = None,
    image_data: Optional[str] = None
):
    """Update layer properties."""
    project = await get_project(project_id)

    for layer in project.layers:
        if layer.id == layer_id:
            if name is not None:
                layer.name = name
            if visible is not None:
                layer.visible = visible
            if opacity is not None:
                layer.opacity = opacity
            if blend_mode is not None:
                layer.blend_mode = blend_mode
            if order is not None:
                layer.order = order
            if image_data is not None:
                layer.image_base64 = image_data

            project.layers.sort(key=lambda x: x.order)
            project.updated_at = datetime.utcnow()
            save_project_to_file(project)
            return layer

    raise HTTPException(status_code=404, detail="Layer not found")


@router.delete("/projects/{project_id}/layers/{layer_id}")
async def delete_layer(project_id: str, layer_id: str):
    """Delete a layer from the project."""
    project = await get_project(project_id)

    for i, layer in enumerate(project.layers):
        if layer.id == layer_id:
            project.layers.pop(i)
            project.updated_at = datetime.utcnow()
            save_project_to_file(project)
            return {"message": "Layer deleted"}

    raise HTTPException(status_code=404, detail="Layer not found")


@router.post("/projects/{project_id}/layers/{layer_id}/duplicate", response_model=Layer)
async def duplicate_layer(project_id: str, layer_id: str, new_name: Optional[str] = None):
    """Duplicate a layer."""
    project = await get_project(project_id)

    for layer in project.layers:
        if layer.id == layer_id:
            new_layer = Layer(
                id=str(uuid.uuid4()),
                name=new_name or f"{layer.name} (Copy)",
                type=layer.type,
                image_base64=layer.image_base64,
                visible=layer.visible,
                opacity=layer.opacity,
                blend_mode=layer.blend_mode,
                order=layer.order + 1
            )

            project.layers.append(new_layer)
            project.layers.sort(key=lambda x: x.order)
            project.updated_at = datetime.utcnow()
            save_project_to_file(project)
            return new_layer

    raise HTTPException(status_code=404, detail="Layer not found")


# Layer operations with masks

@router.post("/projects/{project_id}/layers/{layer_id}/apply-mask")
async def apply_mask_to_layer(project_id: str, layer_id: str, mask_layer_id: str, invert: bool = False):
    """Apply a mask layer to an image layer."""
    project = await get_project(project_id)

    image_layer = None
    mask_layer = None

    for layer in project.layers:
        if layer.id == layer_id:
            image_layer = layer
        if layer.id == mask_layer_id:
            mask_layer = layer

    if not image_layer:
        raise HTTPException(status_code=404, detail="Image layer not found")
    if not mask_layer:
        raise HTTPException(status_code=404, detail="Mask layer not found")

    # Apply mask to image
    result_base64 = apply_mask_to_image(
        image_layer.image_base64,
        mask_layer.image_base64,
        invert=invert
    )

    # Create new layer with result
    new_layer = Layer(
        id=str(uuid.uuid4()),
        name=f"{image_layer.name} (Masked)",
        type="image",
        image_base64=result_base64,
        visible=True,
        opacity=1.0,
        blend_mode="normal",
        order=len(project.layers)
    )

    project.layers.append(new_layer)
    project.updated_at = datetime.utcnow()
    save_project_to_file(project)

    return new_layer


@router.post("/projects/{project_id}/layers/{layer_id}/extract")
async def extract_from_layer(project_id: str, layer_id: str, mask_layer_id: str):
    """Extract portion of image defined by mask."""
    project = await get_project(project_id)

    image_layer = None
    mask_layer = None

    for layer in project.layers:
        if layer.id == layer_id:
            image_layer = layer
        if layer.id == mask_layer_id:
            mask_layer = layer

    if not image_layer or not mask_layer:
        raise HTTPException(status_code=404, detail="Layer not found")

    result_base64 = extract_with_mask(
        image_layer.image_base64,
        mask_layer.image_base64
    )

    new_layer = Layer(
        id=str(uuid.uuid4()),
        name=f"{image_layer.name} (Extracted)",
        type="image",
        image_base64=result_base64,
        visible=True,
        opacity=1.0,
        blend_mode="normal",
        order=len(project.layers)
    )

    project.layers.append(new_layer)
    project.updated_at = datetime.utcnow()
    save_project_to_file(project)

    return new_layer


@router.post("/projects/{project_id}/masks/combine")
async def combine_mask_layers(
    project_id: str,
    mask_layer_ids: List[str],
    operation: str = "union",
    result_name: str = "Combined Mask"
):
    """Combine multiple mask layers with specified operation."""
    project = await get_project(project_id)

    masks = []
    for layer_id in mask_layer_ids:
        for layer in project.layers:
            if layer.id == layer_id:
                masks.append(layer.image_base64)
                break

    if len(masks) < 2:
        raise HTTPException(status_code=400, detail="At least 2 mask layers required")

    result_base64 = combine_masks(masks, operation)

    new_layer = Layer(
        id=str(uuid.uuid4()),
        name=result_name,
        type="mask",
        image_base64=result_base64,
        visible=True,
        opacity=1.0,
        blend_mode="normal",
        order=len(project.layers)
    )

    project.layers.append(new_layer)
    project.updated_at = datetime.utcnow()
    save_project_to_file(project)

    return new_layer


@router.post("/projects/{project_id}/composite")
async def composite_layers(
    project_id: str,
    background_layer_id: str,
    foreground_layer_id: str,
    position_x: int = 0,
    position_y: int = 0,
    opacity: float = 1.0
):
    """Composite foreground layer onto background layer."""
    project = await get_project(project_id)

    bg_layer = None
    fg_layer = None

    for layer in project.layers:
        if layer.id == background_layer_id:
            bg_layer = layer
        if layer.id == foreground_layer_id:
            fg_layer = layer

    if not bg_layer or not fg_layer:
        raise HTTPException(status_code=404, detail="Layer not found")

    result_base64 = composite_images(
        bg_layer.image_base64,
        fg_layer.image_base64,
        position=(position_x, position_y),
        opacity=opacity
    )

    new_layer = Layer(
        id=str(uuid.uuid4()),
        name="Composited Layer",
        type="image",
        image_base64=result_base64,
        visible=True,
        opacity=1.0,
        blend_mode="normal",
        order=len(project.layers)
    )

    project.layers.append(new_layer)
    project.updated_at = datetime.utcnow()
    save_project_to_file(project)

    return new_layer


@router.post("/projects/{project_id}/flatten")
async def flatten_project(project_id: str):
    """Flatten all visible layers into a single layer."""
    project = await get_project(project_id)

    visible_layers = [l for l in sorted(project.layers, key=lambda x: x.order) if l.visible]

    if not visible_layers:
        raise HTTPException(status_code=400, detail="No visible layers to flatten")

    # Start with the bottom layer
    result = base64_to_image(visible_layers[0].image_base64).convert("RGBA")

    # Composite each layer on top
    for layer in visible_layers[1:]:
        layer_image = base64_to_image(layer.image_base64).convert("RGBA")

        # Apply opacity
        if layer.opacity < 1.0:
            alpha = layer_image.split()[3]
            alpha = alpha.point(lambda x: int(x * layer.opacity))
            layer_image.putalpha(alpha)

        result = Image.alpha_composite(result, layer_image)

    result_base64 = image_to_base64(result)

    return {
        "flattened_image": result_base64,
        "width": result.width,
        "height": result.height
    }


@router.post("/projects/{project_id}/export")
async def export_project(project_id: str, format: str = "png"):
    """Export the flattened project as an image file."""
    flatten_result = await flatten_project(project_id)

    image_bytes = base64_to_bytes(flatten_result["flattened_image"])

    return StreamingResponse(
        io.BytesIO(image_bytes),
        media_type=f"image/{format}",
        headers={"Content-Disposition": f"attachment; filename=export.{format}"}
    )


# Image upload

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image and return base64."""
    contents = await file.read()

    # Validate it's an image
    try:
        image = Image.open(io.BytesIO(contents))
        image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    base64_data = base64.b64encode(contents).decode("utf-8")

    # Get image info
    image = Image.open(io.BytesIO(contents))

    return {
        "image_base64": base64_data,
        "width": image.width,
        "height": image.height,
        "format": image.format,
        "filename": file.filename
    }


from pydantic import BaseModel

class UrlImportRequest(BaseModel):
    url: str

@router.post("/import-url")
async def import_from_url(request: UrlImportRequest):
    """Import an image from a URL."""
    import httpx

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(request.url, timeout=30.0)
            response.raise_for_status()

        contents = response.content

        # Validate it's an image
        image = Image.open(io.BytesIO(contents))
        image.verify()

        base64_data = base64.b64encode(contents).decode("utf-8")

        # Get image info
        image = Image.open(io.BytesIO(contents))

        return {
            "image_base64": base64_data,
            "width": image.width,
            "height": image.height,
            "format": image.format,
            "source_url": request.url
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to import image: {str(e)}")
