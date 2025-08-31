from fastapi import APIRouter
from pydantic import BaseModel
from ..services.model_registry import registry


router = APIRouter(tags=["models"])


class ModelInfo(BaseModel):
    engine: str
    name: str


class SelectModelRequest(BaseModel):
    engine: str
    name: str


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    return [ModelInfo(**m) for m in registry.get_available()]


@router.post("/models/select", response_model=ModelInfo)
async def select_model(req: SelectModelRequest):
    active = registry.set_active(req.engine, req.name)
    return ModelInfo(**active)


@router.get("/models/active", response_model=ModelInfo)
async def get_active_model():
    return ModelInfo(**registry.get_active())


@router.get("/models/labels", response_model=list[str])
async def get_labels():
    return registry.get_labels()


@router.get("/models/status")
async def get_status():
    return registry.status()
