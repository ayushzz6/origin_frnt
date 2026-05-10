// DEPRECATED: this client used to POST to /interaction/doubts/*. Those routes
// still exist as a server-side shim, but new code should import directly from
// '@/features/origin-ai/client' (named-thread CRUD: createOriginAiThread,
// listOriginAiThreads, sendOriginAiMessage(message, ctx, null, threadId), …).
//
// This file now re-exports the legacy adapters that wrap the origin-ai
// endpoints, so any leftover importers continue to work but no longer hit the
// /interaction/doubts/* path.
export {
  listDoubtSessions,
  createDoubtSession,
  updateDoubtSessionTitle,
  sendSolverMessage,
} from "@/features/origin-ai/legacy-client";
