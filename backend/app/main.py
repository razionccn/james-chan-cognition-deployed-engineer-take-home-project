"""FastAPI entrypoint for the Fintech Operations Console backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.errors import install_error_handlers
from app.core.personas import DEMO_PERSONAS
from app.core.registry import installed_apps


def create_app() -> FastAPI:
    app = FastAPI(title="Fintech Operations Console API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok", "apps": [m.APP_ID for m in installed_apps()]}

    @app.get("/api/personas")
    def personas() -> dict:
        """DEV-ONLY: list the simulated personas the UI can switch between."""
        return {
            "simulated": True,
            "personas": [
                {"id": p.id, "name": p.name, "role": p.role} for p in DEMO_PERSONAS.values()
            ],
        }

    for module in installed_apps():
        app.include_router(module.router, prefix=f"/api/{module.APP_ID}", tags=[module.APP_ID])

    return app


app = create_app()
