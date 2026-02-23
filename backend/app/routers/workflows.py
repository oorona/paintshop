from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime
from pathlib import Path

from ..models.schemas import Workflow, WorkflowStep

router = APIRouter(prefix="/api", tags=["Workflows"])

# Predefined workflows
PREDEFINED_WORKFLOWS: List[Workflow] = [
    Workflow(
        id="pet-pirate",
        name="Pet to Pirate",
        description="Extract a pet from an image and transform it into a pirate character",
        steps=[
            WorkflowStep(
                step_type="segment",
                prompt_template_id="extract-subject",
                parameters={"subject": "pet", "auto_mask": True}
            ),
            WorkflowStep(
                step_type="edit",
                prompt_template_id="pet-costume",
                style_id="chibi",
                parameters={"costume": "pirate", "style": "chibi"}
            )
        ]
    ),
    Workflow(
        id="portrait-stylize",
        name="Portrait Stylization",
        description="Extract a person and apply artistic style transformation",
        steps=[
            WorkflowStep(
                step_type="segment",
                prompt_template_id="extract-subject",
                parameters={"subject": "person"}
            ),
            WorkflowStep(
                step_type="edit",
                prompt_template_id="style-transform",
                style_id="oil-painting",
                parameters={"target_style": "Renaissance oil painting"}
            )
        ]
    ),
    Workflow(
        id="product-promo",
        name="Product Promo",
        description="Generate professional product images with multiple backgrounds",
        steps=[
            WorkflowStep(
                step_type="segment",
                prompt_template_id="extract-subject",
                parameters={"subject": "product"}
            ),
            WorkflowStep(
                step_type="edit",
                prompt_template_id="background-change",
                parameters={"new_background": "clean white studio with soft shadows"}
            ),
            WorkflowStep(
                step_type="edit",
                prompt_template_id="background-change",
                parameters={"new_background": "modern lifestyle setting"}
            )
        ]
    ),
    Workflow(
        id="fantasy-character",
        name="Fantasy Character Creation",
        description="Transform a portrait into a fantasy character with magical elements",
        steps=[
            WorkflowStep(
                step_type="segment",
                prompt_template_id="extract-subject",
                parameters={"subject": "person"}
            ),
            WorkflowStep(
                step_type="edit",
                prompt_template_id="outfit-change",
                style_id="fantasy-epic",
                parameters={"new_outfit": "magical wizard robes with glowing runes"}
            ),
            WorkflowStep(
                step_type="edit",
                prompt_template_id="background-change",
                parameters={"new_background": "mystical enchanted forest with floating lights"}
            )
        ]
    ),
    Workflow(
        id="anime-transform",
        name="Anime Transformation",
        description="Transform any portrait into anime style",
        steps=[
            WorkflowStep(
                step_type="edit",
                style_id="anime-manga",
                parameters={"preserve_likeness": True}
            )
        ]
    ),
]

# Custom workflows storage
custom_workflows: Dict[str, Workflow] = {}


def get_workflow_storage_path() -> Path:
    """Get the path for workflow storage."""
    path = Path("/app/sessions/workflows")
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_custom_workflows():
    """Load custom workflows from storage."""
    global custom_workflows
    storage_path = get_workflow_storage_path()
    for file_path in storage_path.glob("*.json"):
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
                workflow = Workflow(**data)
                custom_workflows[workflow.id] = workflow
        except Exception:
            continue


def save_workflow(workflow: Workflow):
    """Save a workflow to storage."""
    storage_path = get_workflow_storage_path()
    file_path = storage_path / f"{workflow.id}.json"
    with open(file_path, "w") as f:
        json.dump(workflow.model_dump(), f, indent=2, default=str)


# Load custom workflows on startup
load_custom_workflows()


@router.get("/workflows", response_model=List[Workflow])
async def list_workflows():
    """List all available workflows."""
    return PREDEFINED_WORKFLOWS + list(custom_workflows.values())


@router.get("/workflows/{workflow_id}", response_model=Workflow)
async def get_workflow(workflow_id: str):
    """Get a specific workflow by ID."""
    for workflow in PREDEFINED_WORKFLOWS:
        if workflow.id == workflow_id:
            return workflow
    if workflow_id in custom_workflows:
        return custom_workflows[workflow_id]
    raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/workflows", response_model=Workflow)
async def create_workflow(workflow: Workflow):
    """Create a custom workflow."""
    if not workflow.id:
        workflow.id = str(uuid.uuid4())

    if workflow.id in custom_workflows or any(w.id == workflow.id for w in PREDEFINED_WORKFLOWS):
        raise HTTPException(status_code=400, detail="Workflow ID already exists")

    workflow.created_at = datetime.utcnow()
    workflow.updated_at = datetime.utcnow()

    custom_workflows[workflow.id] = workflow
    save_workflow(workflow)

    return workflow


@router.put("/workflows/{workflow_id}", response_model=Workflow)
async def update_workflow(workflow_id: str, workflow: Workflow):
    """Update a custom workflow."""
    if any(w.id == workflow_id for w in PREDEFINED_WORKFLOWS):
        raise HTTPException(status_code=400, detail="Cannot modify predefined workflows")

    if workflow_id not in custom_workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow.id = workflow_id
    workflow.updated_at = datetime.utcnow()

    custom_workflows[workflow_id] = workflow
    save_workflow(workflow)

    return workflow


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Delete a custom workflow."""
    if any(w.id == workflow_id for w in PREDEFINED_WORKFLOWS):
        raise HTTPException(status_code=400, detail="Cannot delete predefined workflows")

    if workflow_id in custom_workflows:
        del custom_workflows[workflow_id]

        # Remove from storage
        storage_path = get_workflow_storage_path()
        file_path = storage_path / f"{workflow_id}.json"
        if file_path.exists():
            file_path.unlink()

        return {"message": "Workflow deleted"}

    raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/workflows/{workflow_id}/duplicate", response_model=Workflow)
async def duplicate_workflow(workflow_id: str, new_name: Optional[str] = None):
    """Duplicate an existing workflow."""
    source_workflow = None

    for workflow in PREDEFINED_WORKFLOWS:
        if workflow.id == workflow_id:
            source_workflow = workflow
            break

    if not source_workflow and workflow_id in custom_workflows:
        source_workflow = custom_workflows[workflow_id]

    if not source_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Create a copy with new ID
    new_workflow = Workflow(
        id=str(uuid.uuid4()),
        name=new_name or f"{source_workflow.name} (Copy)",
        description=source_workflow.description,
        steps=source_workflow.steps.copy(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    custom_workflows[new_workflow.id] = new_workflow
    save_workflow(new_workflow)

    return new_workflow
