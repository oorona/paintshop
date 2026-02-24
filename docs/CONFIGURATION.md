## Configuration

This document explains configuration and environment variables used by the backend and deployment.

Gemini API key
- The backend (`GeminiService`) attempts to locate your Gemini API key in this order:
  - Path pointed by `GEMINI_API_KEY_FILE` environment variable
  - Docker secret path: `/run/secrets/gemini_api_key`
  - Local repo secrets file: `secrets/gemini_api_key.txt`
  - Environment variable `GEMINI_API_KEY`

To set the key as an environment variable (example):

```bash
export GEMINI_API_KEY="your_api_key_here"
```

Session storage
- Sessions are stored in JSON files by default under `/app/sessions` (see `SessionService` default). When running locally, the backend writes session files to `data/sessions` unless overridden by container configuration.

Model selection and defaults
- Supported image/understanding models are enumerated in `backend/app/models/schemas.py`. The system selects defaults appropriate for the task (generation, segmentation, detection, prompt assistance).

Docker / Compose
- To pass the secret into the container, use Docker secrets or mount the file. Example `docker-compose.yml` uses a secret named `gemini_api_key`.

Other configuration hints
- Logging: backend prints diagnostic messages to stdout. Configure container logging drivers as needed.
- Cost & billing parameters live in `backend/app/utils/cost_calculator.py`—update unit prices there if you want custom estimates.

Security
- Never commit your API key to source control. Use Docker secrets or environment variables in production.

Traefik / Domain
- The Compose setup uses Traefik for HTTP routing. The frontend service reads the external host from an environment variable so the domain is not hard-coded in `docker-compose.yml`.
- Define the domain in a `.env` file at the repository root (Docker Compose will automatically load it). Example `.env`:

```env
PAINTSHOP_HOST=paintshop.home.iktdts.com
```

- The frontend service in `docker-compose.yml` uses `PAINTSHOP_HOST` in the Traefik `Host()` rule. To enable HTTPS with Traefik's `websecure` entrypoint and automatic certificates (e.g. Let's Encrypt), add the following labels alongside the router definition:

```yaml
traefik.http.routers.paintshop.entrypoints=websecure
traefik.http.routers.paintshop.tls=true
```

- If you want Traefik to manage both frontend and backend routing, add similar router/service labels to the `backend` service and set appropriate `server.port` values.
