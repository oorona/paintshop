## Installation & Quickstart

Prerequisites
- Docker & Docker Compose (for production-like deployment)
- Python 3.11 (for backend development)
- Node 16+ / npm or Yarn (for frontend development)
- Git (to clone repository)

Production (recommended)
1. Ensure Docker and Docker Compose are installed.
2. Build and run the stacks:

```bash
docker-compose build
docker-compose up -d
```

3. Ensure the Gemini API key is provided to the backend via one of the supported methods (see configuration document).
4. Open the frontend through Traefik at `https://${PAINTSHOP_HOST}`.

Development (backend)
1. Create a Python virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Provide your Gemini API key (see configuration) and run the server:

```bash
uvicorn app.main:app --reload
```

Development (frontend)
1. Install frontend dependencies and run the dev server:

```bash
cd frontend
npm install
npm run dev
```

Secrets / API key
- The backend looks for the Gemini API key in this order:
  1. `GEMINI_API_KEY_FILE` environment variable (path to a file)
  2. Docker secret at `/run/secrets/gemini_api_key`
  3. `secrets/gemini_api_key.txt` in the repo root
  4. `GEMINI_API_KEY` environment variable

Create the `secrets` folder and add your key during development:

```bash
mkdir -p secrets
echo "YOUR_ACTUAL_API_KEY" > secrets/gemini_api_key.txt
```

Notes
- For local development you do not need Docker but do ensure the Gemini API key file or environment variable is configured.
- Use `docker-compose` for an environment closer to production (with separated networks as configured in `docker-compose.yml`).
