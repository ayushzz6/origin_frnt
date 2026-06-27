# document-import-service

Phase 10 FastAPI worker for the teacher Question Bag + admin OGCode
import flows. Implements the pipeline described in
[`V1/teacher-admin-launch-plan/04-document-import-and-ogcode-publishing.md`](../teacher-admin-launch-plan/04-document-import-and-ogcode-publishing.md):

```
classify → extract (text/OCR) → multimodal fallback → verify → persist
```

## Endpoints

- `GET /health` – service liveness + dependency configuration check.
- `GET /ready`  – is the DB pool reachable.
- `POST /v1/import-jobs/{job_id}/run` – run the full pipeline for one
  job. Requires `Authorization: Bearer $DOCUMENT_IMPORT_SERVICE_TOKEN`.

The Next.js side calls `/v1/import-jobs/{id}/run` immediately after it
inserts the `import.document_import_jobs` row. The run handler reads the
source asset from R2, drives the pipeline stages, and updates the job
+ pages + draft questions tables in-place.

## Environment

| Variable | Purpose |
|---|---|
| `DOCUMENT_IMPORT_DATABASE_URL` | Postgres conninfo (same DB as the rest of ORIGIN). |
| `DOCUMENT_IMPORT_SERVICE_TOKEN` | Bearer secret Next.js uses to authenticate. |
| `R2_ENDPOINT_URL` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 credentials. |
| `GEMINI_API_KEY` | Multimodal fallback. Optional — if absent the pipeline still runs but skips vision. |
| `GEMINI_VISION_MODEL` | Defaults to `gemini-3.5-flash`. |
| `DOCUMENT_IMPORT_FORCE_HYBRID` | When `true`, classifier prefers HYBRID_RECONCILE — useful for hard-case regression files. |

## Run locally

```bash
cd document-import-service
pip install -r requirements.txt
DOCUMENT_IMPORT_SERVICE_TOKEN=devtoken \
  DOCUMENT_IMPORT_DATABASE_URL=postgresql://origin:origin@localhost:5432/origin \
  uvicorn app.main:app --reload --port 8020
```

System packages needed: `tesseract-ocr`, `poppler-utils` (Dockerfile
installs both).

## Tests

```bash
cd document-import-service
PYTHONPATH=. python -m pytest tests/
```

The unit tests don't need a DB; they exercise the classifier, parser,
and verifier directly. The integration test in
`tests/test_pipeline_e2e.py` skips when `DOCUMENT_IMPORT_DATABASE_URL`
is unset.
