from typing import Any, List, Dict, Optional
from threading import Lock
from pathlib import Path


class ModelRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._active: dict[str, Any] = {"engine": "dummy", "name": "moving_box"}
        self._engine_impl: Any = None
        self._available: List[Dict[str, str]] = []
        self._labels: List[str] = ["object"]
        self._last_error: Optional[str] = None
        self.scan_models()
        # default to YOLO if present
        for m in self._available:
            if m["engine"] == "yolo":
                try:
                    self.set_active(m["engine"], m["name"])
                    break
                except Exception:
                    # leave dummy active if YOLO fails to load
                    continue

    def scan_models(self) -> None:
        avail: List[Dict[str, str]] = []
        backend_dir = Path(__file__).resolve().parents[2]
        models_dir = backend_dir / "models"
        # YOLO defaults
        seen = set()
        # Offer a small set of common models that Ultralytics can auto-download
        default_yolos = ["yolo11n.pt", "yolo11s.pt", "yolov8n.pt", "yolov8s.pt"]
        for nm in default_yolos:
            key = ("yolo", nm)
            if key not in seen:
                avail.append({"engine": "yolo", "name": nm}); seen.add(key)
        yolo_dir = models_dir / "yolo"
        if yolo_dir.exists():
            for p in yolo_dir.glob("*.pt"):
                key = ("yolo", p.name)
                if key not in seen:
                    avail.append({"engine": "yolo", "name": p.name}); seen.add(key)
        # TensorFlow SavedModel directories
        tf_dir = models_dir / "tf"
        if tf_dir.exists():
            for p in tf_dir.glob("*/saved_model.pb"):
                name = p.parent.name
                key = ("tensorflow", name)
                if key not in seen:
                    avail.append({"engine": "tensorflow", "name": name}); seen.add(key)
        # Always include dummy
        avail.append({"engine": "dummy", "name": "moving_box"})
        self._available = avail

    def get_available(self) -> List[Dict[str, str]]:
        return list(self._available)

    def _load_engine(self, engine: str, name: str):
        if engine == "yolo":
            from ..engines.yolo_ultralytics import YOLOEngine
            # Resolve path relative to repo
            backend_dir = Path(__file__).resolve().parents[2]
            model_path = (backend_dir / "models" / "yolo" / name)
            if model_path.exists():
                impl = YOLOEngine(str(model_path))
            else:
                impl = YOLOEngine(name)
            return impl
        elif engine == "dummy":
            from ..engines.dummy_engine import engine as dummy
            return dummy
        else:
            # Future: TF/ONNX/OpenVINO
            from ..engines.dummy_engine import engine as dummy
            return dummy

    def get_active(self) -> dict[str, Any]:
        return self._active.copy()

    def get_labels(self) -> List[str]:
        return list(self._labels)

    def set_active(self, engine: str, name: str) -> dict[str, Any]:
        with self._lock:
            try:
                self._engine_impl = self._load_engine(engine, name)
                self._active = {"engine": engine, "name": name}
                self._last_error = None
            except Exception as e:
                # fallback to dummy and record error
                from ..engines.dummy_engine import engine as dummy
                self._engine_impl = dummy
                self._active = {"engine": "dummy", "name": "moving_box"}
                self._last_error = f"{type(e).__name__}: {e}"
            # extract labels if available
            labels = getattr(self._engine_impl, "labels", None)
            if isinstance(labels, list) and labels:
                self._labels = labels
            else:
                self._labels = ["object"]
            return self._active.copy()

    def infer(
        self,
        image: Any,
        conf: Optional[float] = None,
        iou: Optional[float] = None,
        max_results: Optional[int] = None,
        classes: Optional[list[int]] = None,
        min_area_ratio: Optional[float] = None,
    ) -> dict:
        impl = self._engine_impl
        if impl is None:
            # load default
            self.set_active(self._active["engine"], self._active["name"])
            impl = self._engine_impl
        # dummy engine has infer(width,height)
        if hasattr(impl, "infer"):
            try:
                return impl.infer(image, conf=conf, iou=iou, max_results=max_results, classes=classes, min_area_ratio=min_area_ratio)  # type: ignore[arg-type]
            except TypeError:
                # fallback for dummy signature
                try:
                    w, h = (getattr(image, "size", (640, 480)))
                except Exception:
                    w, h = (640, 480)
                return impl.infer(w, h)
        return {"time_ms": 0.0, "detections": []}

    def status(self) -> Dict[str, Any]:
        info = None
        try:
            if hasattr(self._engine_impl, 'info'):
                info = self._engine_impl.info()
        except Exception:
            info = None
        return {
            "active": self.get_active(),
            "labels": self.get_labels(),
            "last_error": self._last_error,
            "impl": type(self._engine_impl).__name__ if self._engine_impl is not None else None,
            "engine_info": info,
        }


registry = ModelRegistry()
