from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import time
from PIL import Image
import io
from ..schemas.infer import InferResponse, Detection as DetectionSchema
from ..services.model_registry import registry


router = APIRouter(tags=["infer"])


class _Ack(BaseModel):
    ok: bool


@router.post("/infer/image", response_model=InferResponse)
async def infer_image(
    file: UploadFile = File(...),
    conf: float | None = None,
    iou: float | None = None,
    max_results: int | None = None,
    include_classes: str | None = None,  # comma-separated labels
    min_area_ratio: float | None = None,
):
    started = time.perf_counter()
    data = await file.read()
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        img = None
    classes_idx = None
    if include_classes:
        labels = registry.get_labels()
        want = [s.strip() for s in include_classes.split(',') if s.strip()]
        classes_idx = [i for i, lab in enumerate(labels) if lab in want]
    try:
        out = registry.infer(
            img if img is not None else (640, 480),
            conf=conf,
            iou=iou,
            max_results=max_results,
            classes=classes_idx,
            min_area_ratio=min_area_ratio,
        )
    except Exception as e:
        # graceful fallback on engine errors
        out = {"time_ms": 0.0, "detections": []}
    elapsed = (time.perf_counter() - started) * 1000.0
    return InferResponse(time_ms=elapsed or out.get("time_ms", 0.0), detections=[DetectionSchema(**d) for d in out["detections"]])


@router.websocket("/infer/stream")
async def infer_stream(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_bytes()
            try:
                img = Image.open(io.BytesIO(data)).convert("RGB")
            except Exception:
                img = None
            try:
                out = registry.infer(img if img is not None else (640, 480), conf=None, iou=None, max_results=None)
            except Exception:
                out = {"time_ms": 0.0, "detections": []}
            payload = {"ts": time.time(), **out}
            await ws.send_json(payload)
    except WebSocketDisconnect:
        return
