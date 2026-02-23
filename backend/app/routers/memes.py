from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
import base64
import io
import time
import httpx
from pydantic import BaseModel
from PIL import Image

router = APIRouter(prefix="/api/memes", tags=["Memes"])

IMGFLIP_API = "https://api.imgflip.com/get_memes"
MEME_CACHE_TTL = 60 * 30  # 30 minutes
_meme_cache: Dict[str, Any] = {"timestamp": 0, "data": []}


class MemeTemplate(BaseModel):
  id: str
  name: str
  url: str
  width: int
  height: int
  box_count: int
  tags: List[str] = []
  thumbnail_url: Optional[str] = None


def _derive_tags(name: str) -> List[str]:
  """Create simple tags from a meme name."""
  return [part.lower() for part in name.replace("-", " ").replace("_", " ").split()]


async def _fetch_memes(force_refresh: bool = False) -> List[Dict[str, Any]]:
  """Fetch meme templates from Imgflip with simple in-memory caching."""
  now = time.time()
  if not force_refresh and _meme_cache["data"] and (now - _meme_cache["timestamp"] < MEME_CACHE_TTL):
    return _meme_cache["data"]

  async with httpx.AsyncClient(timeout=15) as client:
    try:
      response = await client.get(IMGFLIP_API)
      response.raise_for_status()
      payload = response.json()
    except Exception as exc:
      raise HTTPException(status_code=502, detail=f"Failed to reach Imgflip: {exc}")

  if not payload.get("success"):
    raise HTTPException(status_code=502, detail="Imgflip API responded with success=false")

  memes = payload.get("data", {}).get("memes", [])
  _meme_cache["data"] = memes
  _meme_cache["timestamp"] = now
  return memes


async def _download_image_to_base64(url: str) -> str:
  """Download an image and return base64 data."""
  async with httpx.AsyncClient(timeout=15) as client:
    response = await client.get(url)
    response.raise_for_status()
    return base64.b64encode(response.content).decode("utf-8")


async def _download_thumbnail(url: str, max_size: int = 150) -> str:
  """Download and downscale an image to a small base64 thumbnail."""
  async with httpx.AsyncClient(timeout=15) as client:
    response = await client.get(url)
    response.raise_for_status()
    image_bytes = response.content

  try:
    image = Image.open(io.BytesIO(image_bytes))
    image.thumbnail((max_size, max_size))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")
  except Exception:
    # Fallback to original if resizing fails
    return base64.b64encode(image_bytes).decode("utf-8")


@router.get("", response_model=List[MemeTemplate])
async def list_memes(search: Optional[str] = None):
  """List meme templates from Imgflip (remote)."""
  memes = await _fetch_memes()

  results: List[MemeTemplate] = []
  for meme in memes:
    name = meme.get("name", "Unknown")
    tags = _derive_tags(name)

    if search:
      query = search.lower()
      if query not in name.lower() and not any(query in tag for tag in tags):
        continue

    results.append(
      MemeTemplate(
        id=str(meme.get("id")),
        name=name,
        url=meme.get("url"),
        width=meme.get("width", 0),
        height=meme.get("height", 0),
        box_count=meme.get("box_count", 0),
        tags=tags,
        thumbnail_url=meme.get("url"),
      )
    )

  return results


@router.get("/{meme_id}")
async def get_meme(meme_id: str):
    """Get a single meme template by ID."""
    memes = await _fetch_memes()
    meme = next((m for m in memes if str(m.get("id")) == str(meme_id)), None)

    # If not in cache, force refresh once (Imgflip list can rotate)
    if not meme:
        memes = await _fetch_memes(force_refresh=True)
        meme = next((m for m in memes if str(m.get("id")) == str(meme_id)), None)

    if not meme:
        raise HTTPException(status_code=404, detail="Meme not found")

    name = meme.get("name", "Unknown")
    return MemeTemplate(
        id=str(meme.get("id")),
        name=name,
        url=meme.get("url"),
        width=meme.get("width", 0),
        height=meme.get("height", 0),
        box_count=meme.get("box_count", 0),
        tags=_derive_tags(name),
        thumbnail_url=meme.get("url"),
    )


@router.get("/{meme_id}/image")
async def get_meme_image(meme_id: str):
    """Download meme image from Imgflip and return as base64."""
    meme = await get_meme(meme_id)  # reuses validation and data mapping
    try:
        image_base64 = await _download_image_to_base64(meme.url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download meme image: {exc}")

    filename = meme.url.split("/")[-1] if meme.url else f"{meme_id}.jpg"

    return {
        "id": meme_id,
        "image_base64": image_base64,
        "filename": filename,
    }


@router.post("/refresh")
async def refresh_meme_index():
    """Force refresh meme cache from Imgflip."""
    memes = await _fetch_memes(force_refresh=True)
    return {"message": "Cache refreshed from Imgflip", "count": len(memes)}
