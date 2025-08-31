You are a senior full-stack engineer. Create a production-grade object detection web app with:

- Backend: Python 3.11+, FastAPI (+ Uvicorn), primary engine = TensorFlow/Keras (SavedModel). Optional engines: Ultralytics YOLO (PyTorch), ONNX Runtime, OpenVINO. Production serving options: TensorFlow Serving or NVIDIA Triton (documented, switchable).
- Frontend: React (Vite, JavaScript), Tailwind + daisyUI theme “forest” (+ shadcn/ui/Radix primitives), TanStack Query, Zustand, React Hook Form + Zod, responsive/mobile-first UX.
- I/O: Camera (desktop/phone, rear cam default), Video file, Image file. Live overlay, FPS & inference ms, per-class filter, snapshot download. PWA + offline shell. No analytics.

## Monorepo layout
/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ api/
│  │  │  ├─ routes_infer.py          # REST + WebSocket
│  │  │  ├─ routes_models.py         # list/switch models
│  │  ├─ core/
│  │  │  ├─ config.py                # env, CORS, limits
│  │  │  ├─ logging.py               # structlog + uvicorn
│  │  ├─ engines/
│  │  │  ├─ tf_engine.py             # TensorFlow/Keras SavedModel
│  │  │  ├─ yolo_ultralytics.py      # Ultralytics YOLOv11/8 (PyTorch)
│  │  │  ├─ onnx_engine.py           # ONNX Runtime
│  │  │  ├─ openvino_engine.py       # OpenVINO runtime
│  │  ├─ utils/
│  │  │  ├─ preprocess.py            # resize/letterbox, normalize
│  │  │  ├─ postprocess.py           # NMS, to common format
│  │  │  ├─ draw.py                  # optional PIL overlay
│  │  ├─ schemas/
│  │  │  ├─ infer.py                 # Pydantic(BaseModel) v2
│  │  ├─ services/
│  │  │  ├─ model_registry.py        # local model discovery, labels
│  │  ├─ tests/
│  │  │  └─ test_infer.py
│  ├─ models/
│  │  ├─ tf/efficientdet_d0/         # default TF SavedModel sample
│  │  ├─ yolo/yolo11n.pt             # example Ultralytics weights
│  │  ├─ onnx/yolo.onnx              # placeholder
│  │  └─ openvino/yolo.xml           # placeholder
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ README.md
└─ frontend/
   ├─ index.html
   ├─ src/
   │  ├─ main.jsx
   │  ├─ App.jsx
   │  ├─ components/
   │  │  ├─ TopBar.jsx
   │  │  ├─ SourceSelector.jsx
   │  │  ├─ DetectorView.jsx
   │  │  ├─ ControlsPanel.jsx
   │  │  ├─ ResultsPanel.jsx
   │  │  └─ UpdateToast.jsx
   │  ├─ hooks/
   │  │  ├─ useMediaStream.js      # start/stop/switch camera, torch
   │  │  ├─ useVideoFile.js
   │  │  └─ useImageFile.js
   │  ├─ lib/
   │  │  ├─ canvas/draw.js         # DPR-aware overlay
   │  │  ├─ api/client.js          # fetch/ws wrappers (TanStack Query)
   │  │  ├─ pwa/registerSW.js
   │  │  └─ state/store.js         # Zustand for controls/state
   │  ├─ styles/index.css
   │  └─ config.js                 # backend URL, feature flags
   ├─ public/manifest.webmanifest
   ├─ public/icons/*
   ├─ tailwind.config.js
   ├─ postcss.config.js
   ├─ vite.config.js
   ├─ package.json
   └─ README.md

## Back end — detailed plan

### Framework & shape
- Use FastAPI with async endpoints; JSON via orjson; CORS allow local dev; limit request size.
- Provide both REST and WebSocket:
  - POST /v1/infer/image        → base64/image bytes → detections[]
  - POST /v1/infer/video        → chunked frames (optional); returns job id or stream
  - WS  /v1/infer/stream        → binary frames; emits detections per frame
  - GET /v1/models              → list available models/engines
  - POST /v1/models/select      → switch active model/engine
- Common detection schema: {class, score, bbox:[x,y,w,h], time_ms}
- Use a “model registry” that maps engine_type→loader + label map.
- Minimal CPU path must handle ~416–640 input.

### Engines
- **TensorFlow/Keras (primary)**: load a TF SavedModel (e.g., EfficientDet or SSD). Pre/post: letterbox, normalize, batched NMS (tf.image.combined_non_max_suppression).
- **Ultralytics YOLO (optional)**: load `yolo11n.pt` (or `yolov8n.pt`) via `ultralytics` Python API; return detections to common schema.
- **ONNX Runtime (optional)**: load `models/onnx/yolo.onnx`; run session (CPU by default); NMS in NumPy.
- **OpenVINO (optional CPU accel)**: compile ONNX or IR; run inference for edge (no NVIDIA).
- **Serving (prod)**: document swapping FastAPI in-process engine for TensorFlow Serving or NVIDIA Triton endpoints with same schema.

### Performance & safety
- Warm-up pass on startup; keep single model instance; engine mutex if swapping.
- Optional image downscale (low-power mode).
- Backpressure on WS stream; drop frames if queue grows.
- Basic rate limiting (per-IP) and file size caps.

### Python dependencies (requirements.txt)
fastapi uvicorn[standard] pydantic orjson pillow numpy opencv-python
tensorflow==2.*           # default engine
ultralytics               # optional YOLO11/YOLO8 engine
onnxruntime               # CPU ONNX path
openvino                  # optional
scikit-image              # utilities
albumentations            # augment (if you add training)
supervision               # optional visualization utils
python-multipart          # uploads
loguru                    # logging
gunicorn                  # prod w/ Uvicorn workers (optional)

### Env & config (.env)
APP_ENV=dev
CORS_ORIGINS=http://localhost:5173
ENGINE=tf                  # tf | yolo | onnx | openvino | triton | tfserving
MODEL_PATH=backend/models/tf/efficientdet_d0
CONF_THRESH=0.5
IOU_THRESH=0.45
MAX_RESULTS=100

### Dockerfile (backend)
- Base: python:3.11-slim; install system libs (libgl1, libglib2.0-0) for OpenCV.
- Multi-stage for smaller image; CMD `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

### Tests
- PyTest for /v1/infer/image happy path & schema.

## Front end — detailed plan

### Framework & styling
- Vite + React (JS), Tailwind + **daisyUI (theme “forest”)**, **shadcn/ui** for form/menus, Radix Primitives for a11y. Icons via lucide-react.
- State: Zustand for controls; TanStack Query for API & WS cache; react-hook-form + zod for validation.
- PWA with offline shell via vite-plugin-pwa; show “update available” toast.

### Key components
- **TopBar**: app name “SwiftDetect”, backend status chip (engine/model), FPS chip, buttons: Start/Stop, Switch Camera, Torch (if supported), Save Snapshot, Clear.
- **SourceSelector**: Camera | Video | Image (segmented).
- **DetectorView**:
  - Camera: `<video playsInline muted autoplay>` with `<canvas>` overlay; rAF loop sends frames via WS; draw boxes.
  - Video file: hidden `<video>` tag + canvas; Play/Pause; rAF→infer loop.
  - Image: single POST; render overlay.
  - DPR-aware canvas; orientation fix for phone images (use EXIF if needed).
- **ControlsPanel**: confidence slider (0.1–0.9), IoU slider (0.3–0.7), max results, low-power toggle (downscale), auto-draw toggle, class multi-select.
- **ResultsPanel**: list detections (label, %), bbox coords; filter toggles.
- **UpdateToast**: new SW available.

### NPM dependencies (frontend)
react react-dom
@tanstack/react-query zustand
react-hook-form zod
tailwindcss postcss autoprefixer daisyui
@radix-ui/react-dropdown-menu @radix-ui/react-dialog
lucide-react
vite vite-plugin-pwa
react-dropzone

### Camera/mobile specifics
- Default to `{ facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }`.
- **Switch Camera** recreates stream with “user”/“environment”.
- **Torch** when `MediaStreamTrack.getCapabilities().torch` is true; apply via `track.applyConstraints({ advanced: [{ torch: true }] })`.
- iOS Safari: start video only after user gesture; `playsInline`.

### API integration
- REST: `POST /v1/infer/image` (multipart or base64) → detections[]
- WS: `ws://…/v1/infer/stream` → send raw JPEG/PNG frames (binary). Server responds: `{ts, fps, time_ms, detections:[...]}`.

### Snapshot
- Merge video/img frame + overlay into an offscreen canvas; `toDataURL('image/png')` then download.

### PWA
- Cache: index.html, JS/CSS, icons, and a small “demo” TF model for offline demo page. Main inference requires network unless model is packaged on server; document both modes.

## Project setup commands (document in READMEs)

# Backend
python -m venv .venv && source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install --upgrade pip
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm create vite@latest swift-detect -- --template react
npm i
npm i -D tailwindcss postcss autoprefixer daisyui vite-plugin-pwa
npx tailwindcss init -p
npm i @tanstack/react-query zustand react-hook-form zod lucide-react @radix-ui/react-dropdown-menu @radix-ui/react-dialog react-dropzone
npm run dev

## Implementation notes (must code)
- Backend:
  - `main.py` wires CORS, routes, and health.
  - `routes_infer.py`:
    - `/v1/infer/image`: accept multipart file; dispatch to active engine; return normalized detections.
    - `/v1/infer/video`: accept small videos; process keyframes (optional).
    - `/v1/infer/stream` (WS): receive binary frames; infer; send results (JSON).
  - Engines return common dicts: {class, score, bbox:[x,y,w,h]} in source pixel coords.
  - `model_registry.py`: scans `backend/models/*` and loads (lazy); exposes labels list; switch engine/model at runtime under a lock.
- Frontend:
  - `DetectorView.jsx`: rAF loop for camera/video; throttle with `requestAnimationFrame`; show FPS & inference ms.
  - DPR-aware drawing in `lib/canvas/draw.js` (crisp boxes/text at any zoom).
  - Controls stored in Zustand; persisted to localStorage.
  - TanStack Query mutation for image POST; WS hook for stream.
- Tests: one happy path unit test + schema validation.

## Docs
- **README (root)**: quickstart, features, architecture diagram, model engine matrix (TF/YOLO/ONNX/OpenVINO/Triton/TF-Serving), how to switch engines, hardware tips (CPU/GPU).
- **backend/README.md**:
  - Export TF SavedModel; export YOLO11 to ONNX; enable OpenVINO; how to point to TensorFlow Serving or Triton endpoints without changing the UI.
- **frontend/README.md**: HTTPS note for camera, mobile quirks, PWA behavior, performance tips.

## Acceptance criteria
- Works locally with `uvicorn` + `vite` dev servers.
- Detects objects from camera/video/image; live overlay; FPS & inference ms.
- Engine can be switched (TF default; YOLO/ONNX/OpenVINO optional).
- WebSocket streaming for live camera at interactive FPS on modern machines.
- Responsive/mobile friendly; PWA offline shell; no analytics.
- Code is clean, commented, and production-oriented.

put the node_module to gitignore

