# Document Import and OGCode Publishing

## Goal

Build a high-accuracy, review-safe question import system for teacher Question Bag and admin/teacher OGCode workflows.

The system must handle:

- PDFs,
- DOC/DOCX,
- image-heavy PDFs,
- scanned documents,
- MCQ,
- MSQ,
- numerical,
- match-the-following,
- assertion/reason,
- passage/table/list context,
- reference diagrams/images/tables,
- answer keys,
- inline answers,
- missing or ambiguous visual references.

It must not silently accept bad partial imports.

## Reference Implementation Insight

The Unimonk test platform already has the correct direction:

- classifier-first routing,
- deterministic parser,
- multimodal fallback,
- hybrid reconcile,
- visual-reference extraction,
- verifier with structural/evidence/cross checks,
- review-required decision gate,
- import job stage tracking.

ORIGIN should reuse the architecture pattern, not copy implementation blindly. ORIGIN needs a more generalized target because teacher Question Bag and OGCode publishing have stronger versioning, asset, attribution, and solution requirements.

## Recommended Service Shape

Create `document-import-service` as a new FastAPI worker service.

```text
Next.js
  -> upload source file to R2
  -> create import.document_import_jobs row
  -> enqueue import job
document-import-service
  -> fetch source asset from R2
  -> classify
  -> extract text/layout
  -> deterministic parse
  -> OCR/multimodal extraction if needed
  -> reconcile
  -> enrich metadata
  -> verify
  -> create draft questions and diagnostics
Next.js
  -> review UI
  -> teacher/admin accepts or edits drafts
```

## Pipeline

### Stage 1: Upload and Job Creation

Next.js:

- validates file type and size,
- stores raw file in R2 via `content.assets`,
- inserts `import.document_import_jobs`,
- returns job id,
- UI shows progress.

Recommended accepted input:

- `application/pdf`,
- DOCX mime types,
- images: PNG/JPEG/WebP,
- later: ZIP of page images.

### Stage 2: Document Classification

Classifier output:

```ts
type DocumentClassification = {
  documentType: "MCQ_PAPER" | "SOURCE_MATERIAL";
  detectedQuestionCount: number | null;
  layoutRisk: "LOW" | "MEDIUM" | "HIGH";
  hasTables: boolean;
  hasPassages: boolean;
  hasVisualReferences: boolean;
  hasEmbeddedImages: boolean;
  hasDiagramReasoning: boolean;
  hasMatchFollowing: boolean;
  hasAssertionReason: boolean;
  isScannedLike: boolean;
  isMixedLayout: boolean;
  preferredStrategy:
    | "TEXT_EXACT"
    | "MULTIMODAL_EXTRACT"
    | "HYBRID_RECONCILE"
    | "GENERATE_FROM_SOURCE";
  reasons: string[];
};
```

Routing rules:

- clean numbered MCQ paper -> deterministic text exact first,
- scanned/image-heavy -> multimodal/OCR first,
- tables/passages/list match/assertion reason -> hybrid or multimodal,
- source material -> generation flow, not extraction flow,
- diagram-heavy with strong text -> text exact plus manual visual capture or visual overlay.

### Stage 3: Extraction

Extraction modes:

- `TEXT_EXACT`: deterministic parser from extracted text.
- `MULTIMODAL_EXTRACT`: page image/OCR/vision-based extraction.
- `HYBRID_RECONCILE`: deterministic parser plus visual/multimodal reconciliation.
- `GENERATE_FROM_SOURCE`: create questions from study material, not from existing mock paper.

The mode must be recorded in diagnostics and per-question evidence.

### Stage 4: Metadata Enrichment

AI can enrich fields that are not explicit:

- subject,
- chapter,
- concept,
- topic,
- difficulty,
- question type,
- tags,
- reference kind.

AI must not invent correct answers when evidence is weak. If answer evidence is missing, mark draft `needs_review`.

### Stage 5: Visual Reference Handling

For questions that require diagrams/images/tables:

- create `content.assets` for page snapshots or extracted images,
- link assets through `content.question_asset_links`,
- mark purpose as `reference_image`, `reference_diagram`, `reference_table`, or `source_page_snapshot`,
- preserve source page and evidence,
- if extraction cannot isolate the diagram, mark question review-required and ask teacher to attach/crop manually.

Human help is expected here. The review UI should show the original page beside the parsed question and allow:

- crop/select diagram,
- upload replacement image,
- assign selected image to one or more questions,
- edit question stem/options/answer,
- mark reviewed.

### Stage 6: Verification

Verifier checks:

- expected count vs extracted count,
- numbering continuity,
- duplicate stems,
- option count integrity,
- exactly one correct option for MCQ,
- correct options for MSQ,
- answer key consistency,
- missing shared context,
- missing visual evidence,
- low confidence,
- parser vs multimodal disagreement,
- suspicious answer distribution,
- hallucinated or generic stems.

Verifier decision:

- `EXACT_ACCEPTED`: safe to create ready questions.
- `REVIEW_REQUIRED`: usable draft, teacher/admin must review.
- `PARTIAL`: partial extraction, only save if user explicitly accepts partial draft.
- `FAILED_WITH_REASON`: do not create questions.

### Stage 7: Persistence

For each accepted/review-required question:

- create `content.questions`,
- create `content.question_versions`,
- set status:
  - `ready` if verifier passes,
  - `needs_review` if warnings/errors need human validation,
  - `draft` if incomplete but intentionally saved,
- store `import_evidence`,
- link reference assets.

## Imported Question Draft Contract

```ts
type ImportedQuestionDraft = {
  stem: string;
  questionType:
    | "mcq"
    | "msq"
    | "numerical"
    | "numerical_with_units"
    | "symbolic_expression"
    | "equation"
    | "matrix_match"
    | "subjective";
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  correctOption?: number | null;
  correctOptions?: number[] | null;
  answerText?: string | null;
  answerSpec?: Record<string, unknown> | null;
  matrixData?: Record<string, unknown> | null;
  hint?: string | null;
  explanation?: string | null;
  fullSolution?: string | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard" | "insane";
  tags: string[];
  sharedContext?: string | null;
  sourcePage?: number | null;
  sourceSnippet?: string | null;
  answerSource?: "ANSWER_KEY" | "INLINE_ANSWER" | "INFERRED" | null;
  confidence?: number | null;
  extractionMode:
    | "TEXT_EXACT"
    | "MULTIMODAL_EXTRACT"
    | "HYBRID_RECONCILE"
    | "GENERATE_FROM_SOURCE";
  referenceKind?: "NONE" | "PASSAGE" | "TABLE" | "LIST_MATCH" | "DIAGRAM" | "GRAPH" | "MAP" | "OTHER";
  referenceAssetIds?: string[];
  reviewReasons: string[];
};
```

## Review UI Requirements

Teacher/admin review screen:

- import job summary,
- file preview,
- extraction strategy and confidence,
- count expected vs extracted,
- verifier issue list,
- question list with statuses,
- side-by-side original source evidence,
- quick filters:
  - missing answer,
  - missing diagram,
  - low confidence,
  - duplicate,
  - shared context issue,
  - ready,
- per-question edit form,
- crop/upload reference image,
- bulk accept ready questions,
- accept partial import only with explicit confirmation.

## Private Question Bag Import Rules

Private Question Bag questions can be saved without hints/full solution.

Minimum required:

- stem,
- answer data or answer spec,
- subject,
- chapter,
- concept/topic,
- difficulty,
- question type.

Optional:

- hint,
- explanation,
- full solution,
- reference assets.

If answer data is missing, the question must remain `needs_review` and cannot be used in a test.

## OGCode Publish Rules

Before a teacher/institute question can publish to OGCode:

- question must be in `ready` state,
- answer data/answer spec must be present,
- hint is required,
- full solved solution is required,
- explanation is recommended,
- required reference assets must be attached,
- subject/chapter/concept/difficulty must be present,
- attribution name must be present,
- platform moderation approval is required unless the workspace has trusted publisher status later.

Validation should block submit-to-OGCode if any mandatory field is missing.

## Edit and Republish Lifecycle

Published public questions cannot be mutated in place.

Flow:

1. Teacher clicks edit.
2. System creates new `content.question_versions` row.
3. Draft edits happen on new version.
4. Teacher submits republish request.
5. Admin reviews.
6. Approved version becomes current public version.
7. Prior public version is preserved for audit and historical attempts.

Historical tests/attempts should keep their question snapshot or version id to prevent score drift.

## Origin AI Integration

For OGCode questions:

1. Origin AI receives `questionVersionId` and `questionSource`.
2. It checks stored `full_solution`, `explanation`, and `hint`.
3. If the student has not attempted the question and policy is hint-only, return hint/concept nudge.
4. If allowed, answer from stored solution first.
5. Only fall back to retrieval/model generation when stored solution is missing or insufficient.

This reduces tokens and keeps answers aligned with teacher-authored solutions.

## Accuracy and Quality Metrics

Track per import:

- exact question count recovery,
- answer alignment rate,
- verifier pass rate,
- review-required rate,
- failed import rate,
- average confidence,
- number of manual diagram attachments,
- source format,
- extraction strategy,
- cost,
- elapsed time.

Maintain a regression corpus:

- clean text PDFs,
- DOCX tests,
- scanned PDFs,
- tables,
- List I/List II match questions,
- assertion/reason,
- answer-before-options,
- inline-answer headers,
- diagram-heavy reasoning,
- real hard files from Unimonk.

Definition of done:

- No silent partial drafts.
- Bad imports are blocked or marked review-required.
- Existing successful formats stay successful.
- Teachers can manually repair diagram/reference issues before using the questions.

