import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/server/auth";
import {
  commitOriginAiVoiceTurn,
  getOriginAiSnapshot,
  getOriginAiVoiceBootstrap,
  respondOriginAiVoiceTurn,
  speakOriginAiVoiceText,
  sendOriginAiMessage,
  serializeThread,
  createThread,
  deleteThread,
  getThreadById,
  listThreads,
  updateThread,
  type OriginAiPageContextInput,
} from "@/server/origin-ai";
import {
  badRequest,
  created,
  forbidden,
  getSlugSegments,
  noContent,
  notFound,
  ok,
  parseJsonBody,
  unauthorized,
} from "@/server/http";
import { withStoreAsync, type StoredUser } from "@/server/store";
import { dbUpdateUsageMetrics } from "@/server/db-users";
import {
  getCachedChapters,
  isOriginAiChapterSubject,
  upsertCachedChapters,
} from "@/server/catalog-cache";
import { getRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { aiLimiter, voiceLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { readRequiredServiceToken, ServiceAuthConfigurationError } from "@/server/service-auth";

export const maxDuration = 120;

// Timeout for regular microservice proxy calls (ms)
const PROXY_TIMEOUT_MS = 30_000;
// TTS synthesis can take longer — give it 75 seconds
const PROXY_TTS_TIMEOUT_MS = 75_000;
// Image solve: vision extraction + embedding search + Gemini Pro generation
const PROXY_IMAGE_TIMEOUT_MS = 180_000;

const ORIGIN_AI_SERVICE_URL = process.env.ORIGIN_AI_SERVICE_URL || "";

const sessionQuerySchema = z.object({
  pathname: z.string().optional(),
  pageKind: z.string().optional(),
  testId: z.string().optional(),
  questionId: z.string().optional(),
  questionAttempted: z.enum(["true", "false"]).optional(),
  questionSolved: z.enum(["true", "false"]).optional(),
});

const visibleQuestionSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  chapter: z.string().nullable().optional(),
  concept: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isSolved: z.boolean().optional(),
});

const pageContextSchema = z.object({
  pathname: z.string().optional(),
  pageKind: z.string().optional(),
  testId: z.string().optional(),
  questionId: z.string().optional(),
  questionTitle: z.string().nullable().optional(),
  questionHint: z.string().nullable().optional(),
  questionSolution: z.string().nullable().optional(),
  questionExplanation: z.string().nullable().optional(),
  questionSubject: z.string().nullable().optional(),
  questionChapter: z.string().nullable().optional(),
  questionConcept: z.string().nullable().optional(),
  questionDifficulty: z.string().nullable().optional(),
  questionAttempted: z.boolean().nullable().optional(),
  questionSolved: z.boolean().nullable().optional(),
  searchQuery: z.string().nullable().optional(),
  activeSubject: z.string().nullable().optional(),
  activeDifficulty: z.string().nullable().optional(),
  activeStatus: z.string().nullable().optional(),
  selectedChapters: z.array(z.string()).optional(),
  totalVisibleQuestions: z.number().int().nonnegative().nullable().optional(),
  visibleQuestions: z.array(visibleQuestionSchema).max(40).optional(),
});

const messageBodySchema = z.object({
  message: z.string().trim().min(1),
  pageContext: pageContextSchema.optional(),
  highlightedText: z.string().nullable().optional(),
  threadId: z.string().trim().min(1).nullable().optional(),
});

const imageSolveBodySchema = z.object({
  imageData: z.string().trim().min(1),
  mimeType: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(50).nullable().optional(),
  threadId: z.string().trim().min(1).nullable().optional(),
});

const createThreadBodySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  subject: z.string().trim().min(1).max(50).nullable().optional(),
});

const updateThreadBodySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  subject: z.string().trim().min(1).max(50).nullable().optional(),
});

const voiceBootstrapBodySchema = z.object({
  pageContext: pageContextSchema.optional(),
});

const voiceTurnBodySchema = z.object({
  userTranscript: z.string().trim().min(1),
  assistantTranscript: z.string().trim().min(1),
  liveSessionId: z.string().trim().nullable().optional(),
  responseId: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  transport: z.literal("gemini_live").optional(),
  interrupted: z.boolean().optional(),
  completionReason: z.enum(["turn_complete", "interrupted", "manual_stop", "unknown"]).optional(),
  assistantAudioChunkCount: z.number().int().nonnegative().optional(),
  assistantTranscriptChunkCount: z.number().int().nonnegative().optional(),
  assistantTextPartChunkCount: z.number().int().nonnegative().optional(),
  hadOutputTranscript: z.boolean().optional(),
  pageContext: pageContextSchema.optional(),
});

const voiceRespondBodySchema = z.object({
  audioData: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  voiceName: z.string().trim().nullable().optional(),
  pageContext: pageContextSchema.optional(),
  highlightedText: z.string().nullable().optional(),
});

const voiceSpeakBodySchema = z.object({
  text: z.string().trim().min(1),
  voiceName: z.string().trim().nullable().optional(),
});

type PageContextLike = Partial<z.infer<typeof pageContextSchema>> & {
  questionAttempted?: boolean | "true" | "false" | null;
  questionSolved?: boolean | "true" | "false" | null;
};

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

async function resolveSlug(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return getSlugSegments(params);
}

function toBooleanFlag(value: boolean | "true" | "false" | null | undefined): boolean | null {
  if (value === true || value === "true") {
    return true;
  }
  if (value === false || value === "false") {
    return false;
  }
  return null;
}

function toPageContext(input?: PageContextLike): OriginAiPageContextInput {
  return {
    pathname: input?.pathname ?? null,
    pageKind: (input?.pageKind as OriginAiPageContextInput["pageKind"]) ?? null,
    testId: input?.testId ?? null,
    questionId: input?.questionId ?? null,
    questionTitle: input?.questionTitle ?? null,
    questionHint: input?.questionHint ?? null,
    questionSolution: input?.questionSolution ?? null,
    questionExplanation: input?.questionExplanation ?? null,
    questionSubject: input?.questionSubject ?? null,
    questionChapter: input?.questionChapter ?? null,
    questionConcept: input?.questionConcept ?? null,
    questionDifficulty: input?.questionDifficulty ?? null,
    questionAttempted: toBooleanFlag(input?.questionAttempted),
    questionSolved: toBooleanFlag(input?.questionSolved),
    searchQuery: input?.searchQuery ?? null,
    activeSubject: input?.activeSubject ?? null,
    activeDifficulty: input?.activeDifficulty ?? null,
    activeStatus: input?.activeStatus ?? null,
    selectedChapters: input?.selectedChapters ?? null,
    totalVisibleQuestions: input?.totalVisibleQuestions ?? null,
    visibleQuestions: input?.visibleQuestions ?? null,
  };
}

/* --------------------------------------------------------------------------
 * Proxy helper: forwards requests to the Origin AI Python microservice
 * when ORIGIN_AI_SERVICE_URL is configured. Falls back to the in-app
 * TypeScript implementation otherwise.
 * ----------------------------------------------------------------------- */

async function proxyToMicroservice(
  method: string,
  path: string,
  body: unknown,
  request: NextRequest,
  user: StoredUser,
): Promise<Response | null> {
  if (!ORIGIN_AI_SERVICE_URL) {
    return null; // fallback to in-app implementation
  }

  const browserSessionId = request.headers.get("X-Origin-AI-Session-Id") ?? "";
  const requestId = getRequestId(request.headers);
  let serviceToken: string;
  try {
    serviceToken = readRequiredServiceToken("ORIGIN_AI_SERVICE_TOKEN");
  } catch (error) {
    const message = error instanceof ServiceAuthConfigurationError
      ? error.message
      : "Origin AI service token is not configured.";
    console.error("[origin-ai proxy] service token missing", { requestId, path });
    return new Response(JSON.stringify({ detail: message, requestId }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isTts = path.includes('/voice/speak');
  const isImageSolve = path.includes('/image-solve');
  const isMessage = path.includes('/chat/message');
  const timeoutMs = isTts ? PROXY_TTS_TIMEOUT_MS : (isImageSolve || isMessage) ? PROXY_IMAGE_TIMEOUT_MS : PROXY_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${ORIGIN_AI_SERVICE_URL}${path}`, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceToken}`,
        [REQUEST_ID_HEADER]: requestId,
        "X-Origin-AI-Session-Id": browserSessionId,
        "X-Origin-User-Id": user.id,
        "X-Origin-User-Name": user.name,
        "X-Origin-User-Email": user.email,
        "X-Origin-User-Role": user.role,
        "X-Origin-User-Streak": String(user.streak),
        "X-Origin-User-Student-Class": user.studentClass ?? "",
        "X-Origin-User-Selected-Course": user.selectedCourse ?? "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // 204 No Content (e.g. DELETE) and 304 carry no body — don't try to parse.
    if (resp.status === 204 || resp.status === 304) {
      return new Response(null, { status: resp.status });
    }

    const contentType = resp.headers.get("Content-Type") ?? resp.headers.get("content-type") ?? "";
    const text = await resp.text();
    let data: unknown = null;

    if (text) {
      const looksJson = contentType.includes("application/json")
        || text.trim().startsWith("{")
        || text.trim().startsWith("[");

      if (looksJson) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("[origin-ai proxy] failed to parse upstream JSON", {
            path,
            status: resp.status,
            contentType,
            preview: text.slice(0, 240),
            parseError,
          });
        }
      }

      if (data === null) {
        data = resp.ok
          ? { raw: text }
          : {
              error: text.trim() || `Origin AI service error (${resp.status})`,
              upstreamStatus: resp.status,
            };
      }
    }

    return new Response(JSON.stringify(data ?? {}), {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error("[origin-ai proxy] microservice call timed out", {
        requestId,
        timeoutMs,
        path,
      });
    } else {
      console.error("[origin-ai proxy] microservice call failed, falling back:", {
        requestId,
        error: err instanceof Error ? err.message : String(err),
        path,
      });
    }
    return null; // fallback to in-app implementation
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveProxyUser(request: NextRequest): Promise<StoredUser | null> {
  return withStoreAsync(async (store) => requireUserFromRequest(store, request));
}

function userIdentifier(request: NextRequest): string {
  return (
    request.headers.get("x-origin-user-id") ??
    request.cookies.get("origin_access_token")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.headers.get("x-forwarded-for") ??
    "unknown"
  );
}

function estimateVoiceMinutes(text: string | null | undefined): number {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(words / 2.5)) / 60;
}

function extractProxyTokens(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  const record = payload as Record<string, unknown>;
  const value = record.tokens_used ?? record.tokensUsed;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function extractVoiceText(payload: unknown, fallback?: string | null): string {
  if (!payload || typeof payload !== "object") {
    return fallback ?? "";
  }
  const record = payload as Record<string, unknown>;
  const value = record.answer ?? record.fallbackText ?? record.fallback_text ?? fallback ?? "";
  return typeof value === "string" ? value : "";
}

async function checkOriginAiUsageLimit(
  user: StoredUser,
  input: { voice?: boolean; pageKind?: string | null } = {},
) {
  const usage = await dbUpdateUsageMetrics(user.id, { tokens: 0, voiceMinutes: 0 });
  if (usage.tokensUsedToday >= 200000) {
    return forbidden("You've reached your daily AI usage limit (200k tokens). Please try again tomorrow.");
  }
  if (input.voice && usage.voiceMinutesUsedToday >= 10 && input.pageKind !== "doubt_solver") {
    return forbidden("You've reached your daily voice limit (10 minutes). Please try again tomorrow.");
  }
  return null;
}

async function recordOriginAiProxyUsage(
  userId: string,
  payload: unknown,
  input: { voiceText?: string | null; voiceMinutes?: number | null } = {},
): Promise<void> {
  const tokens = extractProxyTokens(payload);
  const voiceMinutes = input.voiceMinutes ?? (input.voiceText !== undefined ? estimateVoiceMinutes(input.voiceText) : 0);
  if (tokens > 0 || voiceMinutes > 0) {
    await dbUpdateUsageMetrics(userId, { tokens, voiceMinutes });
  }
}

async function proxyJsonResponse(proxyResp: Response): Promise<unknown> {
  return proxyResp.json().catch(() => null);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);

  // GET /origin-ai/chapters?subject=math — list NCERT chapters for a subject
  if (slug.length === 1 && slug[0] === "chapters") {
    const limited = await checkRateLimit(generalLimiter, userIdentifier(request));
    if (limited) return limited;

    const subject = request.nextUrl.searchParams.get("subject");
    if (!isOriginAiChapterSubject(subject)) {
      return badRequest("Invalid subject. Must be one of: math, phy, chem, bio");
    }

    if (ORIGIN_AI_SERVICE_URL) {
      const proxyUser = await resolveProxyUser(request);
      if (!proxyUser) return unauthorized();
      const proxyResp = await proxyToMicroservice(
        "GET",
        `/api/v1/chapters?subject=${encodeURIComponent(subject)}`,
        null,
        request,
        proxyUser,
      );
      if (proxyResp) {
        const data = await proxyResp.json().catch(() => null);
        if (proxyResp.ok) {
          await upsertCachedChapters(subject, data ?? {});
          return ok(data ?? {}, { headers: { "X-Origin-AI-Catalog-Cache": "refresh" } });
        }

        const cached = await getCachedChapters(subject);
        if (cached) {
          return ok(cached.payload, {
            headers: {
              "X-Origin-AI-Catalog-Cache": "stale",
              "X-Origin-AI-Catalog-Fetched-At": cached.fetchedAt,
            },
          });
        }

        return new Response(JSON.stringify(data ?? { detail: "Origin AI chapter listing failed." }), {
          status: proxyResp.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const cached = await getCachedChapters(subject);
    if (cached) {
      return ok(cached.payload, {
        headers: {
          "X-Origin-AI-Catalog-Cache": "stale",
          "X-Origin-AI-Catalog-Fetched-At": cached.fetchedAt,
        },
      });
    }

    return badRequest("Chapter listing requires the Origin AI microservice and no cached catalog is available.");
  }

  // GET /origin-ai/threads — list named Doubt Solver threads for the user.
  // When ORIGIN_AI_SERVICE_URL is set, threads live in Neon (origin_ai.sessions
  // rows with thread_id IS NOT NULL); otherwise we serve from the local store.
  if (slug.length === 1 && slug[0] === "threads") {
    const limited = await checkRateLimit(generalLimiter, userIdentifier(request));
    if (limited) return limited;

    if (ORIGIN_AI_SERVICE_URL) {
      const proxyUser = await resolveProxyUser(request);
      if (!proxyUser) return unauthorized();
      const proxyResp = await proxyToMicroservice("GET", "/api/v1/chat/threads", null, request, proxyUser);
      if (proxyResp) return proxyResp;
    }

    const result = await withStoreAsync(async (store) => {
      const user = await requireUserFromRequest(store, request);
      if (!user) return { status: "unauthorized" as const };
      return { status: "ok" as const, threads: listThreads(store, user.id).map(serializeThread) };
    });

    if (result.status === "unauthorized") return unauthorized();
    return ok({ threads: result.threads });
  }

  // GET /origin-ai/threads/:threadId — fetch a single thread's full snapshot (messages + metadata).
  if (slug.length === 2 && slug[0] === "threads") {
    const limited = await checkRateLimit(generalLimiter, userIdentifier(request));
    if (limited) return limited;

    if (ORIGIN_AI_SERVICE_URL) {
      const proxyUser = await resolveProxyUser(request);
      if (!proxyUser) return unauthorized();
      const proxyResp = await proxyToMicroservice(
        "GET",
        `/api/v1/chat/threads/${encodeURIComponent(slug[1])}`,
        null,
        request,
        proxyUser,
      );
      if (proxyResp) return proxyResp;
    }

    const result = await withStoreAsync(async (store) => {
      const user = await requireUserFromRequest(store, request);
      if (!user) return { status: "unauthorized" as const };
      const snapshot = await getOriginAiSnapshot(store, user, request, toPageContext({}), slug[1]);
      return { status: "ok" as const, snapshot };
    });

    if (result.status === "unauthorized") return unauthorized();
    return ok(result.snapshot);
  }

  if (slug.length !== 1 || slug[0] !== "session") {
    return notFound();
  }

  const limited = await checkRateLimit(generalLimiter, userIdentifier(request));
  if (limited) return limited;

  const parsedQuery = sessionQuerySchema.safeParse({
    pathname: request.nextUrl.searchParams.get("pathname") ?? undefined,
    pageKind: request.nextUrl.searchParams.get("pageKind") ?? undefined,
    testId: request.nextUrl.searchParams.get("testId") ?? undefined,
    questionId: request.nextUrl.searchParams.get("questionId") ?? undefined,
    questionAttempted: request.nextUrl.searchParams.get("questionAttempted") ?? undefined,
    questionSolved: request.nextUrl.searchParams.get("questionSolved") ?? undefined,
  });

  if (!parsedQuery.success) {
    return badRequest("Invalid Origin AI page context.");
  }

  const proxyUser = await resolveProxyUser(request);
  if (ORIGIN_AI_SERVICE_URL) {
    if (!proxyUser) {
      return unauthorized();
    }
    const proxyResp = await proxyToMicroservice(
      "GET",
      `/api/v1/chat/session?browserSessionId=${request.headers.get("X-Origin-AI-Session-Id") || ""}&pageKind=${parsedQuery.data.pageKind || "unknown"}${parsedQuery.data.questionId ? `&questionId=${encodeURIComponent(parsedQuery.data.questionId)}` : ""}${parsedQuery.data.questionAttempted ? `&questionAttempted=${parsedQuery.data.questionAttempted}` : ""}${parsedQuery.data.questionSolved ? `&questionSolved=${parsedQuery.data.questionSolved}` : ""}`,
      null,
      request,
      proxyUser,
    );
    if (proxyResp) return proxyResp;
  }

  // Fallback to in-app implementation
  const result = await withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return { status: "unauthorized" as const };
    }
    const snapshot = await getOriginAiSnapshot(
      store,
      user,
      request,
      toPageContext({
        ...parsedQuery.data,
        questionAttempted: toBooleanFlag(parsedQuery.data.questionAttempted),
        questionSolved: toBooleanFlag(parsedQuery.data.questionSolved),
      }),
    );
    return { status: "ok" as const, snapshot };
  });

  if (result.status === "unauthorized") {
    return unauthorized();
  }

  return ok(result.snapshot);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  const uid = userIdentifier(request);

  const isVoice = slug[0] === "voice";
  const isMessage = slug.length === 2 && slug[0] === "session" && slug[1] === "message";
  const limiter = isMessage ? aiLimiter : isVoice ? voiceLimiter : generalLimiter;
  const limited = await checkRateLimit(limiter, uid);
  if (limited) return limited;

  // POST /origin-ai/threads — create a named thread (body { title?, subject? }).
  if (slug.length === 1 && slug[0] === "threads") {
    let body: unknown;
    try {
      body = await parseJsonBody(request);
    } catch {
      return badRequest("Invalid JSON payload.");
    }
    const parsed = createThreadBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return badRequest("Invalid thread payload.");
    }

    if (ORIGIN_AI_SERVICE_URL) {
      const proxyUser = await resolveProxyUser(request);
      if (!proxyUser) return unauthorized();
      const proxyResp = await proxyToMicroservice(
        "POST",
        "/api/v1/chat/threads",
        parsed.data,
        request,
        proxyUser,
      );
      if (proxyResp) {
        // Python returns the bare ThreadOut; the client expects { thread: … }.
        const data = await proxyResp.json().catch(() => null);
        return created({ thread: data ?? null });
      }
    }

    const result = await withStoreAsync(async (store) => {
      const user = await requireUserFromRequest(store, request);
      if (!user) return { status: "unauthorized" as const };
      const browserSessionId = request.headers.get("X-Origin-AI-Session-Id") ?? `legacy-origin-ai-session-${user.id}`;
      const session = createThread(store, user.id, browserSessionId, {
        title: parsed.data.title,
        subject: parsed.data.subject ?? null,
      });
      return { status: "created" as const, thread: serializeThread(session) };
    });
    if (result.status === "unauthorized") return unauthorized();
    return created({ thread: result.thread });
  }

  // POST /origin-ai/transcribe — STT transcription
  if (slug.length === 1 && slug[0] === "transcribe") {
    if (ORIGIN_AI_SERVICE_URL) {
      const proxyUser = await resolveProxyUser(request);
      if (!proxyUser) return unauthorized();
      let body: unknown;
      try { body = await parseJsonBody(request); } catch { return badRequest("Invalid JSON."); }
      const proxyResp = await proxyToMicroservice("POST", "/api/v1/chat/transcribe", body, request, proxyUser);
      if (proxyResp) return proxyResp;
    }
    return badRequest("Transcription requires the Origin AI microservice.");
  }

  // POST /origin-ai/image-solve — Image problem solver
  if (slug.length === 1 && slug[0] === "image-solve") {
    if (ORIGIN_AI_SERVICE_URL) {
      const proxyUser = await resolveProxyUser(request);
      if (!proxyUser) return unauthorized();
      let body: unknown;
      try { body = await parseJsonBody(request); } catch { return badRequest("Invalid JSON."); }
      const parsedBody = imageSolveBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Valid image data, MIME type, and thread metadata are required.");
      }
      const quotaResponse = await checkOriginAiUsageLimit(proxyUser, { pageKind: "doubt_solver" });
      if (quotaResponse) {
        return quotaResponse;
      }

      const enrichedPayload = {
        ...parsedBody.data,
        subject: parsedBody.data.subject ?? null,
      };
      const proxyResp = await proxyToMicroservice("POST", "/api/v1/chat/image-solve", enrichedPayload, request, proxyUser);
      if (proxyResp) {
        const data = await proxyJsonResponse(proxyResp);
        if (proxyResp.ok) {
          await recordOriginAiProxyUsage(proxyUser.id, data);
        }
        return new Response(JSON.stringify(data ?? {}), {
          status: proxyResp.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return badRequest("Image solving requires the Origin AI microservice.");
  }

  try {
    const body = await parseJsonBody(request);

    if (slug.length === 2 && slug[0] === "session" && slug[1] === "message") {
      const parsedBody = messageBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Message is required.");
      }

      if (ORIGIN_AI_SERVICE_URL) {
        const proxyUser = await resolveProxyUser(request);
        if (!proxyUser) {
          return unauthorized();
        }
        const quotaResponse = await checkOriginAiUsageLimit(proxyUser, {
          pageKind: parsedBody.data.pageContext?.pageKind ?? null,
        });
        if (quotaResponse) {
          return quotaResponse;
        }
        // Enrich the outbound payload with thread metadata the Python service
        // needs: thread_id (so it doesn't write into the floating-avatar
        // session) and subject (so subject_kb scopes its lookup correctly).
        // The local origin-ai store still holds the canonical thread → subject
        // mapping, so we read it here before forwarding.
        let threadSubject: string | null = null;
        if (parsedBody.data.threadId) {
          threadSubject = await withStoreAsync(async (store) => {
            const thread = getThreadById(store, proxyUser.id, parsedBody.data.threadId!);
            return thread?.subject ?? null;
          });
        }
        const enrichedPayload = {
          ...parsedBody.data,
          subject: threadSubject ?? parsedBody.data.pageContext?.activeSubject ?? null,
          pageContext: {
            ...(parsedBody.data.pageContext ?? {}),
            ...(threadSubject && !parsedBody.data.pageContext?.activeSubject
              ? { activeSubject: threadSubject }
              : {}),
          },
        };
        const proxyResp = await proxyToMicroservice("POST", "/api/v1/chat/message", enrichedPayload, request, proxyUser);
        if (proxyResp) {
          const data = await proxyJsonResponse(proxyResp);
          if (proxyResp.ok) {
            await recordOriginAiProxyUsage(proxyUser.id, data);
          }
          return new Response(JSON.stringify(data ?? {}), {
            status: proxyResp.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Fallback
      if (process.env.NODE_ENV !== "production") {
        console.warn("[origin-ai proxy] microservice unavailable; using in-app fallback");
      }
      const result = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const reply = await sendOriginAiMessage(
          store,
          user,
          request,
          parsedBody.data.message,
          toPageContext(parsedBody.data.pageContext),
          {
            userMetadata: { highlightedText: parsedBody.data.highlightedText },
            threadId: parsedBody.data.threadId ?? null,
          },
        );

        if ("error" in reply) {
          if (reply.error === "DAILY_TOKEN_LIMIT_EXCEEDED") {
            return { status: "forbidden" as const, error: "You've reached your daily AI usage limit (200k tokens). Please try again tomorrow." };
          }
          if (reply.error === "DAILY_VOICE_LIMIT_EXCEEDED") {
            return { status: "forbidden" as const, error: "You've reached your daily voice limit (10 minutes). Please try again tomorrow." };
          }
          return { status: "error" as const, error: reply.error };
        }

        return { status: "created" as const, reply };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      if (result.status === "forbidden") {
        return forbidden(result.error);
      }

      if (result.status === "error") {
        return badRequest(result.error, { error: result.error });
      }

      return created(result.reply);
    }

    if (slug.length === 2 && slug[0] === "voice" && slug[1] === "bootstrap") {
      const parsedBody = voiceBootstrapBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Invalid voice bootstrap payload.");
      }

      if (ORIGIN_AI_SERVICE_URL) {
        const proxyUser = await resolveProxyUser(request);
        if (!proxyUser) {
          return unauthorized();
        }
        const proxyResp = await proxyToMicroservice("POST", "/api/v1/voice/bootstrap", parsedBody.data, request, proxyUser);
        if (proxyResp) return proxyResp;
      }

      // Fallback
      const result = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const bootstrap = await getOriginAiVoiceBootstrap(
          store,
          user,
          request,
          toPageContext(parsedBody.data.pageContext),
        );

        if ("error" in bootstrap) {
          return { status: "error" as const, error: bootstrap.error };
        }

        return { status: "ok" as const, bootstrap };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      if (result.status === "error") {
        return badRequest(result.error, { error: result.error });
      }

      return ok(result.bootstrap);
    }

    if (slug.length === 2 && slug[0] === "voice" && slug[1] === "turn") {
      const parsedBody = voiceTurnBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Voice transcripts are required.");
      }

      if (ORIGIN_AI_SERVICE_URL) {
        const proxyUser = await resolveProxyUser(request);
        if (!proxyUser) {
          return unauthorized();
        }
        const quotaResponse = await checkOriginAiUsageLimit(proxyUser, {
          voice: true,
          pageKind: parsedBody.data.pageContext?.pageKind ?? null,
        });
        if (quotaResponse) {
          return quotaResponse;
        }
        const proxyResp = await proxyToMicroservice("POST", "/api/v1/voice/respond", parsedBody.data, request, proxyUser);
        if (proxyResp) {
          const data = await proxyJsonResponse(proxyResp);
          if (proxyResp.ok) {
            await recordOriginAiProxyUsage(proxyUser.id, data, {
              voiceText: parsedBody.data.assistantTranscript,
            });
          }
          return new Response(JSON.stringify(data ?? {}), {
            status: proxyResp.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Fallback
      const result = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const reply = await commitOriginAiVoiceTurn(
          store,
          user,
          request,
          {
            userTranscript: parsedBody.data.userTranscript,
            assistantTranscript: parsedBody.data.assistantTranscript,
            liveSessionId: parsedBody.data.liveSessionId ?? null,
            responseId: parsedBody.data.responseId ?? null,
            model: parsedBody.data.model ?? null,
            transport: parsedBody.data.transport ?? "gemini_live",
            interrupted: parsedBody.data.interrupted ?? false,
            completionReason: parsedBody.data.completionReason ?? "unknown",
            assistantAudioChunkCount: parsedBody.data.assistantAudioChunkCount ?? 0,
            assistantTranscriptChunkCount: parsedBody.data.assistantTranscriptChunkCount ?? 0,
            assistantTextPartChunkCount: parsedBody.data.assistantTextPartChunkCount ?? 0,
            hadOutputTranscript: parsedBody.data.hadOutputTranscript ?? false,
          },
          toPageContext(parsedBody.data.pageContext),
        );

        if ("error" in reply) {
          return { status: "error" as const, error: reply.error };
        }

        return { status: "created" as const, reply };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      if (result.status === "error") {
        return badRequest(result.error, { error: result.error });
      }

      return created(result.reply);
    }

    if (slug.length === 2 && slug[0] === "voice" && slug[1] === "respond") {
      const parsedBody = voiceRespondBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Voice audio payload is required.");
      }

      if (ORIGIN_AI_SERVICE_URL) {
        const proxyUser = await resolveProxyUser(request);
        if (!proxyUser) {
          return unauthorized();
        }
        const quotaResponse = await checkOriginAiUsageLimit(proxyUser, {
          voice: true,
          pageKind: parsedBody.data.pageContext?.pageKind ?? null,
        });
        if (quotaResponse) {
          return quotaResponse;
        }
        const proxyResp = await proxyToMicroservice("POST", "/api/v1/voice/respond", parsedBody.data, request, proxyUser);
        if (proxyResp) {
          const data = await proxyJsonResponse(proxyResp);
          if (proxyResp.ok) {
            await recordOriginAiProxyUsage(proxyUser.id, data, {
              voiceText: extractVoiceText(data),
            });
          }
          return new Response(JSON.stringify(data ?? {}), {
            status: proxyResp.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Fallback
      const result = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const reply = await respondOriginAiVoiceTurn(
          store,
          user,
          request,
          {
            audioData: parsedBody.data.audioData,
            mimeType: parsedBody.data.mimeType,
            voiceName: parsedBody.data.voiceName ?? null,
          },
          toPageContext(parsedBody.data.pageContext),
        );

        if ("error" in reply) {
          if (reply.error === "DAILY_TOKEN_LIMIT_EXCEEDED") {
            return { status: "forbidden" as const, error: "You've reached your daily AI usage limit (200k tokens). Please try again tomorrow." };
          }
          if (reply.error === "DAILY_VOICE_LIMIT_EXCEEDED") {
            return { status: "forbidden" as const, error: "You've reached your daily voice limit (10 minutes). Please try again tomorrow." };
          }
          return { status: "error" as const, error: reply.error };
        }

        return { status: "created" as const, reply };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      if (result.status === "forbidden") {
        return forbidden(result.error);
      }

      if (result.status === "error") {
        return badRequest(result.error, { error: result.error });
      }

      return created(result.reply);
    }

    if (slug.length === 2 && slug[0] === "voice" && slug[1] === "speak") {
      const parsedBody = voiceSpeakBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Voice text payload is required.");
      }

      if (ORIGIN_AI_SERVICE_URL) {
        const proxyUser = await resolveProxyUser(request);
        if (!proxyUser) {
          return unauthorized();
        }
        const quotaResponse = await checkOriginAiUsageLimit(proxyUser, { voice: true });
        if (quotaResponse) {
          return quotaResponse;
        }
        const proxyResp = await proxyToMicroservice("POST", "/api/v1/voice/speak", parsedBody.data, request, proxyUser);
        if (proxyResp) {
          const data = await proxyJsonResponse(proxyResp);
          if (proxyResp.ok) {
            await recordOriginAiProxyUsage(proxyUser.id, data, {
              voiceText: parsedBody.data.text,
            });
          }
          return new Response(JSON.stringify(data ?? {}), {
            status: proxyResp.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Fallback
      const result = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const reply = await speakOriginAiVoiceText({
          text: parsedBody.data.text,
          voiceName: parsedBody.data.voiceName ?? null,
        });

        // Track voice usage
        if (reply.totalDurationSeconds && reply.totalDurationSeconds > 0) {
          const minutes = reply.totalDurationSeconds / 60;
          await dbUpdateUsageMetrics(user.id, { voiceMinutes: minutes });
        }

        return { status: "ok" as const, reply };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      return ok(result.reply);
    }

    if (slug.length === 2 && slug[0] === "voice" && slug[1] === "token") {
      const proxyUser = await resolveProxyUser(request);
      if (!proxyUser) {
        return unauthorized();
      }
      return ok({ transport: "server_voice" });
    }

    return notFound();
  } catch {
    return badRequest("Invalid JSON payload.");
  }
}

// PATCH /origin-ai/threads/:threadId — rename / change subject.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (slug.length !== 2 || slug[0] !== "threads") {
    return notFound();
  }
  const limited = await checkRateLimit(generalLimiter, userIdentifier(request));
  if (limited) return limited;

  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch {
    return badRequest("Invalid JSON payload.");
  }
  const parsed = updateThreadBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return badRequest("Invalid thread payload.");
  }

  if (ORIGIN_AI_SERVICE_URL) {
    const proxyUser = await resolveProxyUser(request);
    if (!proxyUser) return unauthorized();
    const proxyResp = await proxyToMicroservice(
      "PATCH",
      `/api/v1/chat/threads/${encodeURIComponent(slug[1])}`,
      parsed.data,
      request,
      proxyUser,
    );
    if (proxyResp) {
      const data = await proxyResp.json().catch(() => null);
      return ok({ thread: data ?? null });
    }
  }

  const result = await withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) return { status: "unauthorized" as const };
    const session = updateThread(store, user.id, slug[1], {
      title: parsed.data.title,
      subject: parsed.data.subject ?? undefined,
    });
    if (!session) return { status: "not_found" as const };
    return { status: "ok" as const, thread: serializeThread(session) };
  });

  if (result.status === "unauthorized") return unauthorized();
  if (result.status === "not_found") return notFound("Thread not found.");
  return ok({ thread: result.thread });
}

// DELETE /origin-ai/threads/:threadId
export async function DELETE(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (slug.length !== 2 || slug[0] !== "threads") {
    return notFound();
  }
  const limited = await checkRateLimit(generalLimiter, userIdentifier(request));
  if (limited) return limited;

  if (ORIGIN_AI_SERVICE_URL) {
    const proxyUser = await resolveProxyUser(request);
    if (!proxyUser) return unauthorized();
    const proxyResp = await proxyToMicroservice(
      "DELETE",
      `/api/v1/chat/threads/${encodeURIComponent(slug[1])}`,
      null,
      request,
      proxyUser,
    );
    // proxyToMicroservice returns null on transport failure; otherwise we
    // honor the upstream status (204 ok, 404 not found, etc.).
    if (proxyResp) return proxyResp;
  }

  const result = await withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) return { status: "unauthorized" as const };
    const removed = deleteThread(store, user.id, slug[1]);
    return { status: removed ? ("ok" as const) : ("not_found" as const) };
  });

  if (result.status === "unauthorized") return unauthorized();
  if (result.status === "not_found") return notFound("Thread not found.");
  return noContent();
}
