from __future__ import annotations
import time
from typing import Any, List, Dict, Optional

try:
    from ultralytics import YOLO  # type: ignore
except Exception:  # pragma: no cover
    YOLO = None  # type: ignore


class YOLOEngine:
    def __init__(self, model_path: str | None = None) -> None:
        if YOLO is None:
            raise RuntimeError("ultralytics package is not installed")
        self.model = YOLO(model_path or "yolo11n.pt")
        # names is dict[int,str]
        names = self.model.names if hasattr(self.model, "names") else None
        if isinstance(names, dict):
            # convert to index-sorted list
            self.labels = [names[i] for i in sorted(names.keys())]
        else:
            self.labels = ["object"]

    def info(self) -> dict:
        path = getattr(self.model, 'ckpt_path', None) or getattr(self.model, 'pt_path', None) or None
        name = getattr(self.model, 'model', None)
        try:
            name = getattr(name, 'yaml', None) or str(name)
        except Exception:
            name = str(name)
        return {
            "weights_path": str(path) if path else None,
            "labels": len(self.labels),
            "model": name,
        }

    def infer(
        self,
        image: Any,
        conf: Optional[float] = None,
        iou: Optional[float] = None,
        max_results: Optional[int] = None,
        classes: Optional[list[int]] = None,
        min_area_ratio: Optional[float] = None,
    ) -> dict:
        started = time.perf_counter()
        # Force CPU unless user configures otherwise to avoid CUDA issues
        res = self.model.predict(
            image,
            imgsz=640,
            conf=(conf if conf is not None else 0.15),
            iou=(iou if iou is not None else 0.45),
            classes=classes,
            verbose=False,
            device='cpu',
        )
        detections: List[Dict] = []
        if not res:
            return {"time_ms": 0.0, "detections": detections}
        r0 = res[0]
        boxes = getattr(r0, 'boxes', None)
        if boxes is not None and len(boxes) > 0:
            try:
                # Iterate without numpy to avoid surprises
                for b in boxes:
                    # b.xyxy, b.conf, b.cls are tensors of shape [1]
                    x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
                    score = float(b.conf[0].item() if hasattr(b.conf[0], 'item') else b.conf[0])
                    cid = int(b.cls[0].item() if hasattr(b.cls[0], 'item') else b.cls[0])
                    w = x2 - x1
                    h = y2 - y1
                    label = self.labels[cid] if 0 <= cid < len(self.labels) else str(cid)
                    det = {
                        "class_id": cid,
                        "label": label,
                        "score": score,
                        "bbox": [x1, y1, w, h],
                    }
                    detections.append(det)
            except Exception:
                # If iteration fails for any reason, fall back to returning nothing instead of crashing
                detections = []

        # Filter by minimum area ratio if requested
        if min_area_ratio:
            try:
                iw, ih = None, None
                if hasattr(image, 'size'):
                    iw, ih = image.size
                if iw and ih:
                    min_pixels = float(min_area_ratio) * (iw * ih)
                    detections = [d for d in detections if (d['bbox'][2] * d['bbox'][3]) >= min_pixels]
            except Exception:
                pass

        if max_results:
            detections = detections[: int(max_results)]
        elapsed = (time.perf_counter() - started) * 1000.0
        return {"time_ms": elapsed, "detections": detections}
