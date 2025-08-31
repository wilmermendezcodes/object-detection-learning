from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routes_infer import router as infer_router
from .api.routes_models import router as models_router


def create_app() -> FastAPI:
    app = FastAPI(title="SwiftDetect Backend", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=600,
    )

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        max_mb = 10
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > max_mb * 1024 * 1024:
            from fastapi import Response, status
            return Response(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        return await call_next(request)

    app.include_router(infer_router, prefix="/v1")
    app.include_router(models_router, prefix="/v1")

    return app


app = create_app()
