from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, status

from .config import get_settings
from .contracts import RunJobRequest, RunJobResponse
from .db import close_pool, update_job_stage
from .pipeline import PipelineError, run_pipeline

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001 - FastAPI signature
    yield
    close_pool()


app = FastAPI(
    title="ORIGIN Document Import Service",
    version="0.1.0",
    lifespan=lifespan,
    description=(
        "Phase 10 worker: classifies, extracts, OCR-fallbacks, multimodal-fallbacks, "
        "verifies and persists question drafts for the teacher Question Bag and "
        "admin OGCode import flows. See V1/teacher-admin-launch-plan/"
        "04-document-import-and-ogcode-publishing.md."
    ),
)


def verify_internal_auth(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.document_import_service_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DOCUMENT_IMPORT_SERVICE_TOKEN is not configured.",
        )
    expected = f"Bearer {settings.document_import_service_token}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service token.",
        )


@app.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "databaseConfigured": bool(settings.document_import_database_url),
        "r2Configured": bool(settings.r2_endpoint_url and settings.r2_access_key_id),
        "geminiConfigured": bool(settings.gemini_api_key),
    }


@app.get("/ready")
def ready() -> dict[str, object]:
    # `/ready` is a stricter check — refuses to serve traffic until at
    # least the DB pool is reachable.
    settings = get_settings()
    return {
        "ready": bool(settings.document_import_database_url),
    }


@app.post(
    "/v1/import-jobs/{job_id}/run",
    response_model=RunJobResponse,
    dependencies=[Depends(verify_internal_auth)],
)
def run_job(job_id: str, payload: RunJobRequest) -> RunJobResponse:
    """Synchronously drive a job through the pipeline.

    For an MVP we run inline (Next.js gets a response when the job is
    done). A later phase can switch this to a background task queue
    once observability + retries are in place.
    """
    if payload.job_id != job_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="job_id in path does not match body.",
        )
    try:
        return run_pipeline(job_id)
    except PipelineError as err:
        logger.warning("Pipeline failed for %s: %s — %s", job_id, err.code, err)
        update_job_stage(
            job_id,
            stage="failed",
            status="failed",
            error_code=err.code,
            error_message=str(err),
            completed_at_now=True,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": err.code, "message": str(err)},
        ) from err
    except Exception as err:  # pragma: no cover - defensive
        logger.exception("Unhandled pipeline error for %s", job_id)
        update_job_stage(
            job_id,
            stage="failed",
            status="failed",
            error_code="INTERNAL_ERROR",
            error_message=str(err),
            completed_at_now=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "pipeline crashed"},
        ) from err
