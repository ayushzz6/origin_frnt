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
