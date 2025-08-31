# SwiftDetect Backend

## Quickstart

- Create venv and install:
  - Windows: `.venv\\Scripts\\activate`
  - Unix: `source .venv/bin/activate`

```
python -m venv .venv
pip install --upgrade pip
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir backend
```

- Check: `http://localhost:8000/health`
- Docs: `http://localhost:8000/docs`
- Frontend (dev): `http://localhost:8080` (proxied `/api` to backend)

## Endpoints
- `POST /v1/infer/image` — accepts an image file, returns detections (stub)
- `WS /v1/infer/stream` — accepts binary frames, returns detections (stub)
- `GET /v1/models` — list models (stub)
- `POST /v1/models/select` — switch model (stub)

## Notes
- Engines are placeholders; wire real inference under `app/engines/` and `services/model_registry.py`.
- CORS is wide open for local dev; tighten for production.
