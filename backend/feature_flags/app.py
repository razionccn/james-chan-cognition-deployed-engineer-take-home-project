import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import router
from .db import DEFAULT_DB_PATH, connect, init_schema
from .service import ServiceError


def create_app(db_path: str = DEFAULT_DB_PATH) -> FastAPI:
    app = FastAPI(title="Feature-Flag Admin Panel", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.db_path = db_path

    @app.on_event("startup")
    def _startup() -> None:
        conn = connect(db_path)
        try:
            init_schema(conn)
        finally:
            conn.close()

    @app.exception_handler(ServiceError)
    async def _service_error(_: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message})

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", []) if p not in ("query", "body"))
        msg = first.get("msg", "Invalid request.")
        return JSONResponse(
            status_code=422,
            content={"code": "validation_error", "message": f"{loc}: {msg}" if loc else msg, "details": exc.errors()},
        )

    app.include_router(router)

    @app.get("/healthz")
    def healthz() -> dict:
        return {"ok": True}

    return app


app = create_app(os.environ.get("FEATURE_FLAGS_DB", DEFAULT_DB_PATH))
