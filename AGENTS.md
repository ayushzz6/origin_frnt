<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:origin-repo-targets -->
# Origin repo targets — push policy

This working tree (`/Users/xyx/Projects/Origin/V1`) is the **Origin monorepo**. There are two GitHub remotes that ship code, and which one(s) you push to depends entirely on **what part of the tree changed**.

## Remotes

- **Origin main monorepo** — `https://github.com/diprajorigin/ORIGIN-V1.0` (git remote: `origin`)
  - Holds everything: `new-frontend/`, `analytics-service/`, `grader-service/`, `origin-ai/`, infra, docs.
  - Default base branch: `main`.
- **Vercel deployment repo** — `https://github.com/2003origin-spec/origin_frnt` (git remote: `vercel`)
  - Holds **only the Next.js app** (the contents of `new-frontend/`), unprefixed at the repo root (so Vercel can build it directly from `/`).
  - Default base branch: `main`.

When the user says "the main origin repo" they mean `diprajorigin/ORIGIN-V1.0`. When they say "the Vercel deployment repo" they mean `2003origin-spec/origin_frnt`. Do not ask which repo to push to unless the change set is mixed in a way the rules below cannot resolve.

## Push policy by change set

Inspect `git diff` paths against `origin/main` and decide:

| Files changed | Push to monorepo? | Push to Vercel repo? |
|---|---|---|
| Anything under `new-frontend/` only | ✅ yes | ✅ yes — with `new-frontend/` prefix stripped |
| Anything under `analytics-service/`, `grader-service/`, `origin-ai/`, or any other top-level microservice | ✅ yes | ❌ **no** |
| Both `new-frontend/` **and** a microservice in the same commit | ✅ yes | ✅ yes — **but only the `new-frontend/` slice** (cherry-pick or split before syncing) |
| Top-level docs/infra (`README.md`, `.github/`, `ARCHITECTURE.md`, etc.) not under `new-frontend/` | ✅ yes | ❌ no |

The rule of thumb: **the Vercel repo only ever sees Next.js code**. Microservice changes never go to Vercel — they're independent services with their own deploy pipelines.

## Path translation

Monorepo path → Vercel repo path:

- `new-frontend/src/foo` → `src/foo`
- `new-frontend/package.json` → `package.json`
- `new-frontend/src/db/migrations/X.sql` → `src/db/migrations/X.sql`
- etc.

To generate a path-stripped patch from a monorepo commit:

```bash
git format-patch -1 <sha> --stdout \
  | sed -E 's| a/new-frontend/| a/|g; s| b/new-frontend/| b/|g; s|^(--- a/)new-frontend/|\1|; s|^(\+\+\+ b/)new-frontend/|\1|; s|^(rename from )new-frontend/|\1|; s|^(rename to )new-frontend/|\1|' \
  > /tmp/sync.patch
```

Apply against a clean clone of the Vercel repo with `git apply /tmp/sync.patch`.

## Workflow for a frontend/backend change

1. Branch off `origin/main` in this working tree.
2. Make the changes inside `new-frontend/`.
3. Verify locally: `cd new-frontend && npm run typecheck && npm run test:unit && npm run lint`.
4. Commit, push to `origin` (monorepo), open PR against `diprajorigin/ORIGIN-V1.0:main`.
5. Generate the path-stripped patch (see snippet above).
6. In a clean clone of `2003origin-spec/origin_frnt`, fetch `main`, create the **same-named branch**, apply the patch, run `npm install` + `npm run typecheck` + `npm run test:unit` to confirm, commit with the same message, push, open PR against `2003origin-spec/origin_frnt:main`.
7. After Vercel preview goes green and both PRs are reviewed, merge in this order: Vercel repo PR first (so Vercel rebuilds against the new code), then the monorepo PR.

## Workflow for a microservice change

1. Branch off `origin/main`, make the changes inside the service directory (e.g. `grader-service/`).
2. Run the service's own test/lint suite (varies per service — check its README).
3. Commit, push to `origin`, open PR against `diprajorigin/ORIGIN-V1.0:main`.
4. **Do not touch the Vercel repo.** The microservice has its own deploy pipeline.

## Deployment guardrails

When syncing to the Vercel repo, the next Vercel build must succeed and the new feature must work end-to-end. This means changes must keep working with:

- **Neon Postgres** — schemas referenced by `USER_DATABASE_URL` and `OGCODE_DATABASE_URL` (which in this deployment point at the same physical DB so that cross-schema FKs from `rooms.rooms` to `app.teacher_workspaces` / `assessment.tests` validate).
- **Upstash Redis** — session/cache key shape is shared across services.
- **Cloudflare R2** — bucket and object-key conventions used by `content.assets` and the import pipeline.
- **Microservices** — `analytics-service`, `grader-service`, `origin-ai` are consumed by HTTP, so request/response contracts must remain compatible.

If a frontend change requires a microservice change to function (or vice versa), ship the microservice PR first, wait for its deploy, then ship the frontend PR. Do not merge a frontend change that breaks a current-deployment microservice contract.

## Verification before pushing the Vercel repo

Before `git push vercel <branch>` (or pushing in a fresh Vercel-repo clone), run inside that clone:

```bash
npm install
npm run typecheck
npm run test:unit
```

If any of those fail, fix the issue **in the monorepo first**, regenerate the patch, and reapply.
<!-- END:origin-repo-targets -->

<!-- BEGIN:sync-discipline -->
# Lockstep sync discipline — never let the two repos drift

The two-repo setup will drift silently if PRs are merged at different times on each side. We've burned multiple PRs on catch-up syncs already. The following is **not optional**.

## Pre-flight check (every session, before starting work)

Run these three commands at the top of every coding session. If anything is out of sync, fix it first before opening new branches.

```bash
# 1. Local monorepo main matches remote
cd /Users/xyx/Projects/Origin/V1
git fetch origin main && git diff --quiet main origin/main && echo "✓ monorepo main is in sync" || echo "⚠ monorepo main is behind — pull first"

# 2. Local Vercel-deploy clone main matches remote
cd /tmp/origin-frnt-work/origin_frnt
git fetch origin main && git diff --quiet main origin/main && echo "✓ vercel main is in sync" || echo "⚠ vercel main is behind — pull first"

# 3. Cross-repo content match (monorepo new-frontend/ ↔ vercel-deploy root)
diff -rq /Users/xyx/Projects/Origin/V1/new-frontend /tmp/origin-frnt-work/origin_frnt \
  --exclude=.git --exclude=node_modules --exclude=.next --exclude=.vercel \
  --exclude=.claude --exclude='.DS_Store' --exclude='.env*' \
  --exclude='*.tsbuildinfo' --exclude=next-env.d.ts \
  --exclude=.code-review-graph --exclude=.origin-dev \
  --exclude=Dockerfile --exclude=docker --exclude='docker-compose*' \
  --exclude=scratch --exclude=README.md \
  --exclude=data \
  --exclude='scripts/origin-ai-vectors.mjs' \
  2>&1 | grep -v "^Only in" | head
```

Expected output: empty (no file differences). Files that exist `Only in` one side are usually monorepo-only infra (`docker/`, `Dockerfile`, `data/`, microservices) or local-only state (`.env.local`, build caches) — those are fine to ignore. Any **modified file** (`Files X and Y differ`) is real drift and must be resolved.

## When a teammate merges a monorepo PR

The moment you notice a new commit on `diprajorigin/ORIGIN-V1.0:main` that you don't have:

1. **Pull into local monorepo first**: `git checkout main && git pull --ff-only origin main` from `/Users/xyx/Projects/Origin/V1`.
2. **If the PR touched `new-frontend/`**, the same change needs to land on the Vercel-deploy repo. Either:
   - The teammate already opened the twin PR — just wait for them to merge it, then pull on the Vercel-deploy clone.
   - The teammate didn't open the twin — open it yourself using the path-stripped-patch recipe further up in this file.
3. **If the PR touched only microservices** (`analytics-service/`, `grader-service/`, `origin-ai/`, top-level docs), no Vercel-deploy work needed.
4. **Re-run the pre-flight check** afterward to confirm parity.

## Twin PR merge protocol

Every PR pair must follow:

1. Open the monorepo PR and the Vercel-deploy PR with the **same branch name**.
2. Both PRs must show green Vercel build / CI before either is merged.
3. **Merge them within the same browser session**, monorepo first then Vercel-deploy (or the reverse — just don't walk away with only one merged).
4. If you push a follow-up fix commit to one PR (e.g. addressing a build failure), **immediately push the twin commit to the other PR** before merging anything.
5. After both merge, `git pull --ff-only origin main` on both local clones.

Violating step 4 is what caused the last two drifts (PR #11 ↔ #109 follow-ups never crossed over).

## Tracked-asset directories

Two logo directories are intentionally tracked. They're not auto-generated, not local-only:

- **`/logo/`** at the monorepo workspace root — master assets (high-res favicon source, brand SVGs, etc.). Lives in the monorepo only; the Vercel-deploy repo doesn't need them. Never `gitignore` this, never treat it as untracked when seen in `git status`.
- **`new-frontend/public/logo/`** — runtime copies that ship with the Next.js bundle. Served at `/logo/...` in the browser. Lives in both repos (monorepo's `new-frontend/public/logo/` ↔ Vercel-deploy's `public/logo/`).

When new logo files are added, drop them in **both** places: `/logo/` for the master and `new-frontend/public/logo/` for the runtime copy.

## "Why" — incidents this rule prevents

- **Drift incident 1 (PRs #105/#107)**: Phase 7-9 alignment landed on Vercel-deploy first, monorepo lagged → test count diverged.
- **Drift incident 2 (PR #109/#11)**: Build-fix follow-up commit landed only on monorepo, never crossed over → Vercel-deploy main shipped with two empty route files and broke the production build.
- **Phantom conflict (PR #109)**: Monorepo PR was branched before #107/#108 merged, then conflicted with newer types.ts after they did.

All three would have been caught by the pre-flight diff above.
<!-- END:sync-discipline -->

<!-- BEGIN:plan-vs-code-policy -->
# Single source of truth — plan vs code

The teacher-admin launch is sometimes built by other agents (Qwen, Minimax, Codex) against `V1/teacher-admin-launch-plan/*.md`. Their implementations occasionally deviate from the plan — sometimes deliberately, sometimes by oversight. Default convention:

1. **Identify the deviation.** When reviewing other-agent work, compare the actual schema, types, and contracts against `02-database-schema-design.md`, `05-implementation-roadmap.md`, and `06-rbac-and-api-contracts.md`.
2. **Reason which approach is better.** Consider:
   - correctness (security boundaries, FK enforcement, server-side enforcement)
   - data-model coherence (schema location, naming, lifecycle states)
   - future flexibility (does either side block a planned next phase?)
   - cost of change (any of the deviating code already in production?)
3. **Plan wins by default.** The plan is the deliberate design doc and the single source of truth. If the plan wins, refactor the code to match.
4. **Code wins only when the deviation is genuinely better.** If you choose Qwen's (or any other agent's) design over the plan, **update the plan markdown** to reflect that choice. Never leave the plan and the code disagreeing.
5. **Document the decision.** PR description should list each deviation, the chosen winner, and one-sentence reasoning. If the plan was edited to match code, mention which file + section.

Why this matters: the plan is what the next agent reads to build the next phase. A plan/code drift means every subsequent phase inherits ambiguity. Reconciling at review time prevents compounding entropy.

A worked example lives in PR diprajorigin/ORIGIN-V1.0#107 (phases 7-9 alignment), which reasons through 5 deviations Qwen introduced and reconciles all of them to the plan.
<!-- END:plan-vs-code-policy -->

<!-- BEGIN:phase-10-12-services -->
# Phase 10-12 services & env vars

Three platform integrations were added with the teacher-launch phase
10-12 completion (PRs diprajorigin/ORIGIN-V1.0#111 + 2003origin-spec/origin_frnt#13).
When wiring a new environment (Vercel, staging, CI), set the following.

## `document-import-service` (Phase 10)

A new FastAPI worker at `document-import-service/` in the monorepo. It
is **monorepo-only** — never push it to the Vercel-deploy repo. Deploy
it separately (Cloud Run, Render, Fly, etc.) and point Next.js at it:

| Var | Where set | Purpose |
|---|---|---|
| `DOCUMENT_IMPORT_SERVICE_URL` | Next.js | Base URL of the worker. Optional in dev — the trigger no-ops and the job stays in `queued`. |
| `DOCUMENT_IMPORT_SERVICE_TOKEN` | Next.js + worker | Bearer secret for `POST /v1/import-jobs/{id}/run`. Identical value on both sides. |
| `DOCUMENT_IMPORT_DATABASE_URL` | worker | Same Postgres URL as `USER_DATABASE_URL`. The worker writes to `import.*` and reads `content.assets`, so cross-schema FKs validate. |
| `R2_ENDPOINT_URL` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_DEFAULT_BUCKET` | worker | Source-file fetch from R2. |
| `OPENAI_API_KEY` / `OPENAI_VISION_MODEL` | worker | Optional multimodal fallback. When unset the pipeline still runs but skips vision for low-confidence pages. |
| `DOCUMENT_IMPORT_FORCE_HYBRID` | worker | Force classifier into HYBRID_RECONCILE — only useful for regression-corpus CI. |

System packages required in the worker image: `tesseract-ocr`,
`poppler-utils`. The provided `document-import-service/Dockerfile`
installs both.

## Payment webhook (Phase 12)

| Var | Where set | Purpose |
|---|---|---|
| `PAYMENT_WEBHOOK_TOKEN` | Next.js | Bearer secret the payment provider uses to call `/api/enrollments/orders?action=mark_paid` (and `mark_payment_pending` / `mark_failed`). These actions explicitly refuse student-session auth — a logged-in student calling them gets a 401. Configure the same value on the provider side. |

## Migrations to apply (in order)

1. `20260523_phase10_fix_status_enum.sql` — idempotent rename of mis-labeled enum values + drops dead `app.workspace_offerings` / `app.enrollment_orders` from earlier draft.
2. `20260524_phase10_align_import_schema.sql` — adds the plan-canonical columns (`stage`, `target_surface`, `source_asset_id`, `classification`/`diagnostics`/`cost` JSONB, `requested_question_count`, `requested_by`).

Both migrations are idempotent and safe to re-run.
<!-- END:phase-10-12-services -->
