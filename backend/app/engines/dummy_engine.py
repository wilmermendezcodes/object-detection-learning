from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict
import time


@dataclass
class Detection:
    class_id: int
    label: str
    score: float
    bbox: list[float]


class DummyEngine:
    def __init__(self, labels: list[str] | None = None) -> None:
        self.labels = labels or ["object"]

    def infer(self, width: int, height: int) -> dict:
        # produce a simple moving box based on time
        t = time.time()
        size = min(width, height) * 0.3
        x = ( (t * 120) % (max(1, width - size)) )
        y = ( (t * 90) % (max(1, height - size)) )
        det = Detection(
            class_id=0,
            label=self.labels[0],
            score=0.9,
            bbox=[float(x), float(y), float(size), float(size)],
        )
        return {"time_ms": 1.0, "detections": [det.__dict__]}


engine = DummyEngine()

