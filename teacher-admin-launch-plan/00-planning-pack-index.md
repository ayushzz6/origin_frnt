# ORIGIN Final Main Launch Planning Pack

This folder contains the planning baseline for the final main launch phase that adds a real teacher side, institute/coaching side, and stronger admin side on top of the beta ORIGIN V1 app.

The current V1 base is:

- `new-frontend`: Next.js 16 App Router app, React 19, TypeScript, Radix UI, Recharts, Postgres clients.
- `origin-ai`: FastAPI mentor service with page context, stored-solution routing, voice/image flows, R2 upload support, pgvector-backed memory.
- `grader-service`: FastAPI grading service for MCQ, MSQ, matrix match, numerical, units, symbolic, equation, and subjective answer specs.
- `analytics-service`: FastAPI custom-test generation, topic analytics, DPP generation, DPP progress.
- Postgres plus pgvector as the shared source of truth.
- Redis/Upstash-style support for room codes and real-time room state.

## Documents

1. [Product Scope and Flows](./01-product-scope-and-flows.md)
   - Teacher, institute, student, and admin user journeys.
   - Personal vs institute onboarding.
   - Organization code, enrollment, batches, Question Bag, study materials, rooms, tests, analytics, OGCode publishing, and admin controls.

2. [Database Schema Design](./02-database-schema-design.md)
   - Target schema grouped by workspace, enrollment, batches, content, assessments, rooms, analytics, imports, commerce, and audit.
   - Compatibility notes for current `origin_users`, `ogcode_questions`, `rooms.*`, and `analytics.*`.

3. [System Architecture](./03-system-architecture.md)
   - High-level architecture.
   - Low-level service responsibilities and runtime flows.
   - Integration plan for existing microservices and recommended new services.

4. [Document Import and OGCode Publishing](./04-document-import-and-ogcode-publishing.md)
   - Classifier-first hybrid document import architecture inspired by the Unimonk test platform.
   - Human review flow for reference diagrams, tables, and low-confidence parsed questions.
   - OGCode contributor publishing rules and edit/republish lifecycle.

5. [Implementation Roadmap](./05-implementation-roadmap.md)
   - Phased build plan with acceptance criteria and test strategy.
   - Recommended sequencing before coding starts.

6. [RBAC and API Contracts](./06-rbac-and-api-contracts.md)
   - Permission model for platform admin, institute owner/admin/teacher/content manager/analyst, personal teacher, and students.
   - Suggested Next.js route/API layout and internal service contracts.

## Core Product Decision

Use a workspace model.

Every personal teacher and every institute/coaching center owns a `teacher_workspace`. A personal teacher workspace has one owner and optional staff later. An institute workspace supports owners, admins, teachers, content managers, analysts, and support staff from day one.

This avoids building two separate products. The same tables and APIs can power:

- personal teacher batches,
- institute batches,
- organization codes,
- enrolled students,
- unassigned student queue,
- multiple staff login credentials,
- Question Bag,
- study materials,
- teacher-created rooms,
- scheduled tests,
- analytics,
- OGCode publishing attribution,
- future paid direct enrollment.

## Non-Negotiable Architecture Rules

- Browser calls only Next.js public APIs. Browser never calls Python services directly.
- Next.js owns auth, RBAC, tenant scoping, user-safe response shaping, and CRUD orchestration.
- Python services stay compute-focused: grading, analytics, AI import, Origin AI reasoning.
- Postgres is the durable source of truth. Redis is cache, presence, stream, and temporary code support only.
- Question content must be versioned. Edits after publish create a new version and preserve audit history.
- Teacher/institute content must never leak across workspaces unless explicitly published to OGCode or assigned to shared rooms/tests.
- OGCode publishing requires hints and full solved solutions before a question can become public.
- Document imports must never silently create partial drafts that look valid. Low confidence outputs become review-required drafts.

## Assumptions To Confirm Before Coding

- Direct in-app payment/enroll is a later phase, but schema should reserve clean hooks now.
- Institute marketplace discovery is later phase, but institute profiles should be structured now.
- A student can belong to multiple batches in the same workspace and multiple workspaces overall.
- Teachers can assign a student to multiple batches.
- Institute-generated organization codes are public share codes, but staff invite codes should be separate and permissioned.
- The existing beta student-side UX must keep working while teacher/admin features are added behind feature flags.

