from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven settings for the document-import worker.

    Mirrors the contract in V1/teacher-admin-launch-plan/06-rbac-and-api-contracts.md
    ("document-import-service") — Next.js calls /v1/import-jobs/{id}/run
    with PAYMENT_WEBHOOK_TOKEN-style bearer auth (DOCUMENT_IMPORT_SERVICE_TOKEN).
    """

    document_import_database_url: str | None = None
    document_import_service_token: str | None = None
    document_import_log_level: str = "INFO"

    # R2 source-file fetch
    r2_endpoint_url: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_default_bucket: str | None = None

    # Gemini Vision is the multimodal fallback when deterministic + OCR
    # leave a page in a non-confident state.
    gemini_api_key: str | None = None
    gemini_vision_model: str = "gemini-3.5-flash"

    # When set, the classifier prefers HYBRID_RECONCILE over plain
    # TEXT_EXACT — useful for harder regression files in CI.
    document_import_force_hybrid: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
