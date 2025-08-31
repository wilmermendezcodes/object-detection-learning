# AGENTS — Development Guide and Roadmap

This document orients contributors and automation agents to evolve SwiftDetect safely and quickly. It outlines conventions, task queues, and high‑value next steps.

## Project Goals
- Deliver a production‑grade object detection experience with clean UX and reliable back ends.
- Keep engines swappable (YOLO/TF/ONNX/OpenVINO/Serving) with a stable schema.
- Prioritize responsiveness, robustness, and developer ergonomics.

## Codebase Map (Quick)
- Backend FastAPI under `backend/app` with modular engines and a `model_registry` for discovery and selection.
- Frontend React (Vite) under `frontend/` with Tailwind+daisyUI, Zustand state, and a responsive overlay pipeline.

## Conventions
- Python: Pydantic v2 models; FastAPI async endpoints; small, focused modules.
- JS: React 18, functional components, colocate small libs under `src/lib`.
- Styling: Tailwind + daisyUI; keep layout responsive and mobile‑first.
- Default ports: frontend 8080 → proxy `/api` to backend 8000.

## Tasks (Now → Next)
1) Engine Interface + More Back Ends
- Define an explicit `Engine` protocol (init, labels, infer(image, conf, iou, max_results, classes)).
- Implement adapters:
  - TensorFlow SavedModel (EfficientDet/SSD) with combined NMS
  - ONNX Runtime (exported YOLO); CPU default
  - OpenVINO (optimized CPU)
- Add warmup and engine swap mutex; expose `/v1/models/metrics`.

2) Inference UX
- Class‑color map + legend; consistent colors across sessions
- FPS + latency chips; CSV/JSON export of detections
- Snapshot watermark: timestamp, model, engine, thresholds
- Device camera selector + torch toggle (where supported)

3) Performance + Stability
- WS backpressure: adjustable FPS cap; binary queue size guard
- Rate limiting per IP and upload caps; structured logs (e.g., structlog)
- Error toasts and engine status in the UI (show last_error)

4) Training Workflow Docs
- Dataset stats script; auto train/val split; COCO conversion helpers
- Curate hard negatives pipeline; semi‑auto labeling loops
- Export to ONNX/OpenVINO; compare CPU perf vs accuracy

5) Tooling + CI
- Add Ruff/Black and simple pytest for backend
- Vitest for client utilities; Playwright smoke for core flows
- Docker + docker‑compose; GitHub Actions to lint/build/test

## Architectural Notes
- Overlay draws in source pixel coordinates; CSS scales both video+canvas using an aspect‑ratio container for exact alignment.
- Streaming uses a ping‑pong pattern to prevent send backlog and reduce latency.
- Registry resolves model paths relative to backend dir; offers default YOLO models that auto‑download.

## Implementation Tips
- Keep changes minimal and focused; prefer small PRs.
- Use feature flags in `frontend/src/lib/state/store.js` if you need guarded rollouts.
- For engine errors, don’t crash the request; return an empty detection set and log.

## Release Checklist
- Back end: health, infer POST/WS, models list/select/labels/status all pass locally
- Front end: camera start/stop, POST + WS paths, overlays aligned on desktop + mobile
- README and AGENTS updated; ensure commands match configured ports
- Optional: publish a tiny demo weights file or instructions for auto‑download

## Roadmap (Deep‑Dive)
- TensorFlow Serving/Triton swap‑in guide + client adapters
- Multi‑model routing (per request) with quotas and metrics
- Offline demo mode (TF.js or ONNX Web) for GitHub Pages
- Project templates for hosted deployments (Azure, GCP, AWS)
- Observability: OpenTelemetry traces and basic dashboards

---
This guide aims to keep contributors and automation aligned on delivering a fast, reliable detector with a clean UX while preserving optionality for production deployment models.
