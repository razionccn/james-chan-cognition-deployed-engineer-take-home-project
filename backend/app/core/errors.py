"""Shared error type for business-rule and authorization failures.

Services raise AppError; the FastAPI layer turns it into a JSON response of the
shape {"error": {"code": ..., "message": ...}} so every app returns errors the
same way and the frontend can render them uniformly.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"


class InvalidTransitionError(AppError):
    status_code = 409
    code = "invalid_transition"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
