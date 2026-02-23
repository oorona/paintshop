## Architecture Overview

This document explains the component layout and request flow for the project.

Components
- Frontend: React + Vite SPA that provides the image editor UI, layer panel, prompt UI, and workflows. Communicates with backend via REST API under `/api/*`.
- Backend: FastAPI application (`backend/app`) exposing endpoints for generation, editing, segmentation, detection, styles, workflows and session stats.
- Gemini integration: `backend/app/services/gemini_service.py` is the single point of integration with Google's Gemini SDK (image generation, segmentation, detection, VQA, prompt assistance).
- Session & Cost tracking: `backend/app/services/session_service.py` tracks per-session token usage and cost estimates and persists session JSON files.
- Utils: `backend/app/utils` contains `image_utils.py` helpers (base64 conversions, mask expansion) and `cost_calculator.py` for cost estimates.

Request flow (image generation example)
1. Frontend sends `POST /api/generate` with prompt, model choice, style or mask if present.
2. Router `generation` validates request and forwards to `gemini_service.generate_image()`.
3. `GeminiService` prepares prompt, content parts (images, masks) and calls `client.models.generate_content`.
4. Gemini returns multimodal content; `GeminiService` extracts images/text, computes token usage and cost estimate.
5. `SessionService` records request-level token and cost metrics into a session JSON file.
6. Backend returns image base64 or analysis JSON to frontend which renders it in the editor.

Storage & data
- `data/` holds generated outputs, meme assets, and session files used during local development.

Networking & deployment
- `docker-compose.yml` defines two networks (internet-facing for frontend, intranet for backend). The backend is intended to be isolated behind a reverse proxy in production.

Extensibility
- Model support is implemented via enumerations and `GeminiService` configuration. To add new models, update `backend/app/models/schemas.py` and adapt the `_get_generation_config` logic.
