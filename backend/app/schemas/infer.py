from pydantic import BaseModel


class Detection(BaseModel):
    class_id: int
    label: str
    score: float
    bbox: list[float]


class InferResponse(BaseModel):
    time_ms: float
    detections: list[Detection]

