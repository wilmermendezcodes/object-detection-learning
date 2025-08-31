# SwiftDetect — Production-Grade Object Detection Web App

SwiftDetect is a full‑stack, production‑oriented object detection web app. It combines a FastAPI back end with a modern React (Vite) front end to deliver live camera streaming, image/video inference, overlays, model selection, and practical developer ergonomics.

- Fast, clean dev experience with hot reload (frontend 8080, backend 8000)
- Camera, image, and WebSocket streaming with responsive overlays
- Model selection: Ultralytics YOLO family (n/s, v11/v8) with CPU default
- Controls: confidence, IoU, max results, per‑class filter, min box size, temporal smoothing, snapshot download
- Built for production: CORS, body size guard, simple logging, modular engines with a registry

## Monorepo Layout
```
/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                    # FastAPI app + CORS + size limits
│  │  ├─ api/
│  │  │  ├─ routes_infer.py         # POST image + WS stream
│  │  │  └─ routes_models.py        # list/select models + labels/status
│  │  ├─ engines/
│  │  │  ├─ dummy_engine.py         # moving-box demo
│  │  │  └─ yolo_ultralytics.py     # Ultralytics YOLO (CPU by default)
│  │  ├─ services/model_registry.py # discovers models; active engine
│  │  └─ schemas/infer.py
│  ├─ models/
│  │  └─ yolo/                      # place .pt weights here (optional)
│  ├─ requirements.txt
│  └─ README.md
└─ frontend/
   ├─ index.html
   ├─ vite.config.js                # dev server 8080; proxy /api -> 8000
   ├─ src/
   │  ├─ App.jsx, main.jsx
   │  ├─ components/TopBar.jsx, DetectorView.jsx, ControlsPanel.jsx, ResultsPanel.jsx
   │  ├─ lib/api/client.js, lib/canvas/draw.js, lib/state/store.js
   │  └─ styles/index.css
   ├─ package.json
   └─ README.md
```

## Quickstart

Prerequisites: Python 3.11+, Node 18+, Git. On Windows, use PowerShell.

Backend (8000):
- `cd backend`
- `python -m venv .venv`
- PowerShell: `.\\.venv\\Scripts\\Activate.ps1` (CMD: `.venv\\Scripts\\activate.bat`)
- `python -m pip install --upgrade pip`
- `python -m pip install -r requirements.txt`
- Optional YOLO CPU deps: `python -m pip install ultralytics torch torchvision --extra-index-url https://download.pytorch.org/whl/cpu`
- `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- Health: http://localhost:8000/health

Frontend (8080):
- `cd frontend`
- `npm i`
- `npm run dev`
- Open http://localhost:8080

## Using the App
- Start Camera (allow permission) → Detect (POST) or Start WS (live).
- Controls (right panel):
  - Confidence / IoU / Max results
  - Apply class filter (choose classes to include)
  - Min box area (% of frame) to drop tiny boxes
  - Temporal smoothing to reduce one‑frame blips
  - Auto draw overlay, Low power toggle (capture stays native res for alignment)
- Top bar shows backend health, live detection count, and model selector.
- Snapshot merges base frame + overlay and downloads PNG.

## Models and Engines
- YOLO (Ultralytics): active by default if available. Dropdown includes `yolo11n/s` and `yolov8n/s` (auto‑download) plus any `.pt` files in `backend/models/yolo`.
  - CPU by default (`device='cpu'`). Select `yolo:*.pt` to switch.
- Dummy: moving‑box demo to verify end‑to‑end without a model.
- Planned: TensorFlow SavedModel, ONNX Runtime, OpenVINO, TF Serving / Triton as swappable back ends.

Add local weights:
- Copy weights to `backend/models/yolo/your_model.pt`
- Select it in the Model dropdown. Labels auto‑load from the model.

## API
- `GET /health` → `{status}`
- `POST /v1/infer/image` (multipart file) → `{time_ms, detections[]}`
  - Query: `conf`, `iou`, `max_results`, `include_classes=person,chair`, `min_area_ratio=0.01`
- `WS /v1/infer/stream` → send binary JPEG/PNG; server emits `{ts, time_ms, detections[]}`
- `GET /v1/models` / `GET /v1/models/active` / `POST /v1/models/select`
- `GET /v1/models/labels` (array of class names)
- `GET /v1/models/status` (active engine, labels, last_error, engine_info)

## Training Your Own Model (YOLO)
1) Prepare dataset (YOLO format):
- `datasets/yourset/images/{train,val,test}`
- `datasets/yourset/labels/{train,val,test}` with `.txt` annotations
- `datasets/yourset/data.yaml`:
```
train: ../datasets/yourset/images/train
val: ../datasets/yourset/images/val
test: ../datasets/yourset/images/test  # optional
nc: <num_classes>
names: [class1, class2, ...]
```
2) Train (GPU recommended; CPU works but slow):
```
# from repo root (or any shell with ultralytics + torch installed)
yolo task=detect mode=train model=yolo11s.pt data=datasets/yourset/data.yaml imgsz=640 epochs=50 batch=16 device=0
```
3) Deploy best weights:
- Find `runs/detect/train*/weights/best.pt`
- Copy to `backend/models/yolo/yourset_best.pt`
- Select `yolo:yourset_best.pt` in the UI. Labels update automatically.

Tips to reduce false positives:
- Raise `confidence` (0.35–0.5) and `iou` (0.5–0.6)
- Set `min box area` (0.5–1.0% of frame)
- Add hard negatives; capture scenes where the model misfires and retrain
- Prefer yolo11s over yolo11n if CPU budget allows

## YOLO Installation Tips
- CPU only (Windows/Linux/macOS):
  - `python -m pip install ultralytics torch torchvision --extra-index-url https://download.pytorch.org/whl/cpu`
- NVIDIA GPU (Windows/Linux): pick the CUDA build matching your driver, for example CUDA 12.1:
  - `python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`
  - `python -m pip install ultralytics`
- Apple Silicon (M1/M2):
  - `python -m pip install ultralytics torch torchvision`
  - Enable MPS with PyTorch if available; performance varies by model size.
- Verify install:
  - `python -c "import torch, ultralytics; print('torch', torch.__version__, 'cuda', torch.cuda.is_available())"`
- Weights auto‑download: selecting `yolo11n/s` or `yolov8n/s` triggers a one‑time download unless a file is present under `backend/models/yolo/`.
- Common issues:
  - Old CPU without AVX: use older torch CPU wheels or run on a newer machine.
  - Version mismatch: ensure `torch` and `torchvision` versions come from the same index (CPU or specific CUDA version).
  - Corporate proxy: pre‑download weights and place the `.pt` file locally.

## Troubleshooting
- No camera: allow permissions; use Chrome/Edge; localhost is a secure origin.
- 500 on inference: check backend console; `GET /v1/models/status` shows last engine errors.
- Boxes misaligned: ensure overlay is on top and capture stays native res (default). Refresh after rotating the device.
- Slow/laggy boxes: ping‑pong WS is enabled; reduce `confidence` only if recall matters; try `yolo11n` for speed.

## Licensing and Attribution
- Repository code (this project): choose and add a license file (e.g., MIT or Apache‑2.0) to clarify your distribution terms. Until a license file is added, assume “all rights reserved”.
- Ultralytics YOLO:
  - Code is licensed by Ultralytics (currently AGPL‑3.0 for YOLOv8/YOLOv11 code). Review terms: https://github.com/ultralytics/ultralytics
  - Pretrained model weights follow Ultralytics’ model terms. Check the Ultralytics repository or website for the latest model license details before redistribution or commercial use.
- PyTorch/TorchVision: adhere to their respective licenses (BSD‑style). See: https://pytorch.org
- Datasets:
  - COCO annotations are under CC‑BY 4.0; images originate from third‑party sources with varying licenses. Confirm downstream usage rights if you redistribute images.
  - Open Images: labels are CC‑BY 4.0; images remain with their owners.
  - Pascal VOC: images are typically research/education only; verify before commercial use.
  - For any custom data, ensure you have rights to collect, label, and use it for your purposes.
- Trademarks/Privacy:
  - Do not imply endorsement by dataset/model providers.
  - Be mindful of local laws regarding recording/processing camera streams.

## Future Refinements (Roadmap)
- Engines: TensorFlow SavedModel + TF Serving, ONNX Runtime, OpenVINO, Triton
- Model hot‑swap with warmup, per‑engine metrics and structured logs
- Per‑class colors + legend; dark/light themes; better mobile layout polish
- On‑device WebAssembly/TF.js demo mode for fully offline sample
- Rate limiting, auth tokens, and upload size policies
- Docker Compose + CI (lint/test/build) and Playwright smoke tests
- Export snapshots with watermarks (model/engine/timestamp) and share links
- Training helpers: dataset stats, auto‑split, semi‑auto labeling loops

---
SwiftDetect is designed to get you from “hello world” to a robust, production‑ready detector with practical defaults and clear escape hatches.
