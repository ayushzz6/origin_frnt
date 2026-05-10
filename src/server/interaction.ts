import { awardPoints } from "@/server/gamification";
import { solveWithKnowledgeBase } from "@/server/ai-solver-kb";
import {
  createId,
  type AppStore,
  type StoredChatMessage,
  type StoredDoubtSession,
  type StoredUser,
} from "@/server/store";

interface CreateSessionInput {
  title?: string;
  subject?: string;
}

interface UpdateSessionInput {
  title?: string;
  subject?: string;
}

interface AddMessageInput {
  content?: string;
  image?: string;
}

interface SolverTurn {
  content: string;
  metadata: Record<string, unknown>;
  activeConcept?: string | null;
  suggestedTitle?: string | null;
}

const SUBJECT_WORDS = ["physics", "chemistry", "mathematics", "maths", "math", "biology", "bio"] as const;

const GENERIC_SESSION_TITLES = new Set<string>(
  SUBJECT_WORDS.flatMap((s) => [
    `new ${s} session`,
    `${s} doubt session`,
    `${s} - image analysis`,
  ]).concat(["general doubt session", "new general session"]),
);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

function shouldAutoRenameSession(title: string): boolean {
  const normalized = normalizeText(title);
  if (GENERIC_SESSION_TITLES.has(normalized)) return true;
  return SUBJECT_WORDS.some((s) => normalized.startsWith(`new ${s}`));
}

function extractSolverContent(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

async function callExternalSolver(
  session: StoredDoubtSession,
  user: StoredUser,
  input: AddMessageInput,
): Promise<SolverTurn | null> {
  const base = process.env.AI_SOLVER_SERVICE_URL?.trim();
  if (!base) {
    return null;
  }

  const candidateUrls = base.endsWith("/solve") ? [base] : [`${base.replace(/\/$/, "")}/solve`, base];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session: {
            id: session.id,
            title: session.title,
            subject: session.subject,
            activeConcept: session.activeConcept,
            messages: session.messages.slice(-20),
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          input: {
            content: input.content ?? "",
            image: input.image ?? null,
          },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const content =
        extractSolverContent(data.reply) ??
        extractSolverContent(data.response) ??
        extractSolverContent(data.answer) ??
        extractSolverContent((data.aiMessage as Record<string, unknown> | undefined)?.content);

      if (!content) {
        continue;
      }

      const metadataRaw =
        ((data.aiMessage as Record<string, unknown> | undefined)?.metadata as Record<string, unknown> | undefined) ??
        (data.metadata as Record<string, unknown> | undefined) ??
        {};
      const metadata: Record<string, unknown> = {
        ...metadataRaw,
        source: metadataRaw.source ?? "ai_solver_service",
        llmCalled: metadataRaw.llmCalled ?? true,
        serviceUrl: url,
      };

      const activeConcept =
        (typeof data.activeConcept === "string" && data.activeConcept) ||
        (typeof (data.session as Record<string, unknown> | undefined)?.activeConcept === "string"
          ? ((data.session as Record<string, unknown>)?.activeConcept as string)
          : null);
      const suggestedTitle =
        (typeof data.suggestedTitle === "string" && data.suggestedTitle) ||
        (typeof (data.session as Record<string, unknown> | undefined)?.title === "string"
          ? ((data.session as Record<string, unknown>)?.title as string)
          : null);

      return {
        content,
        metadata,
        activeConcept,
        suggestedTitle,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function buildFallbackReply(session: StoredDoubtSession, input: AddMessageInput): SolverTurn {
  return solveWithKnowledgeBase({
    sessionTitle: session.title,
    sessionSubject: session.subject,
    activeConcept: session.activeConcept,
    studentInput: (input.content ?? "").trim(),
    image: input.image ?? null,
  });
}

function toMessagePayload(message: StoredChatMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    image: message.image,
    metadata: message.metadata,
    timestamp: message.timestamp,
  };
}

export function toSessionPayload(session: StoredDoubtSession) {
  const messages = [...session.messages]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .map(toMessagePayload);

  return {
    id: session.id,
    title: session.title,
    subject: session.subject,
    activeConcept: session.activeConcept,
    active_concept: session.activeConcept,
    messages,
    createdAt: session.createdAt,
    created_at: session.createdAt,
    updatedAt: session.updatedAt,
    updated_at: session.updatedAt,
  };
}

export function listDoubtSessions(store: AppStore, userId: string) {
  return store.doubtSessions
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toSessionPayload);
}

export function getDoubtSession(store: AppStore, userId: string, sessionId: string) {
  const session = store.doubtSessions.find((entry) => entry.id === sessionId && entry.userId === userId);
  return session ? toSessionPayload(session) : null;
}

export function createDoubtSession(store: AppStore, userId: string, payload: CreateSessionInput) {
  // Subject is optional now — when blank, ai-solver-kb's crossSubjectLookup
  // resolves the subject from the question itself. Avoid the old "Physics"
  // default that masked Bio/Chem/Math threads as Physics.
  const subject = (payload.subject?.trim() ?? "").slice(0, 50);
  const sessionLabel = subject || "Doubt";
  const title = (payload.title?.trim() || `New ${sessionLabel} Session`).slice(0, 255);
  const timestamp = nowIso();

  const session: StoredDoubtSession = {
    id: createId("doubt"),
    userId,
    title,
    subject,
    activeConcept: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
  store.doubtSessions.push(session);
  return toSessionPayload(session);
}

export function updateDoubtSession(
  store: AppStore,
  userId: string,
  sessionId: string,
  payload: UpdateSessionInput,
) {
  const session = store.doubtSessions.find((entry) => entry.id === sessionId && entry.userId === userId);
  if (!session) {
    return null;
  }

  if (typeof payload.title === "string" && payload.title.trim()) {
    session.title = payload.title.trim().slice(0, 255);
  }
  if (typeof payload.subject === "string" && payload.subject.trim()) {
    session.subject = payload.subject.trim().slice(0, 50);
  }
  session.updatedAt = nowIso();
  return toSessionPayload(session);
}

export function deleteDoubtSession(store: AppStore, userId: string, sessionId: string): boolean {
  const originalLength = store.doubtSessions.length;
  store.doubtSessions = store.doubtSessions.filter((entry) => !(entry.id === sessionId && entry.userId === userId));
  return store.doubtSessions.length !== originalLength;
}

export async function addSessionMessage(
  store: AppStore,
  user: StoredUser,
  sessionId: string,
  payload: AddMessageInput,
) {
  const session = store.doubtSessions.find((entry) => entry.id === sessionId && entry.userId === user.id);
  if (!session) {
    return null;
  }

  const textContent = (payload.content ?? "").trim();
  if (!textContent && !payload.image) {
    return { error: "Content or image is required" as const };
  }

  const userMessage: StoredChatMessage = {
    id: createId("chat"),
    role: "user",
    content: textContent,
    image: payload.image ?? null,
    metadata: {},
    timestamp: nowIso(),
  };
  session.messages.push(userMessage);

  const externalTurn = await callExternalSolver(session, user, payload);
  const solverTurn = externalTurn ?? buildFallbackReply(session, payload);

  if (typeof solverTurn.activeConcept === "string" && solverTurn.activeConcept.trim()) {
    session.activeConcept = solverTurn.activeConcept.trim();
  }

  const shouldRename = shouldAutoRenameSession(session.title);
  if (shouldRename && typeof solverTurn.suggestedTitle === "string" && solverTurn.suggestedTitle.trim()) {
    session.title = solverTurn.suggestedTitle.trim().slice(0, 255);
  }

  const aiMessage: StoredChatMessage = {
    id: createId("chat"),
    role: "assistant",
    content: solverTurn.content,
    image: null,
    metadata: {
      ...solverTurn.metadata,
      concept: session.activeConcept,
    },
    timestamp: nowIso(),
  };
  session.messages.push(aiMessage);
  session.updatedAt = nowIso();

  const today = new Date().toISOString().slice(0, 10);
  const dailySolverPoints = store.pointLogs
    .filter(
      (entry) =>
        entry.userId === user.id && entry.activityType === "ai_solver" && entry.timestamp.slice(0, 10) === today,
    )
    .reduce((total, entry) => total + entry.points, 0);

  if (dailySolverPoints < 25) {
    const pointsToAward = Math.min(5, 25 - dailySolverPoints);
    if (pointsToAward > 0) {
      awardPoints(
        store,
        user.id,
        pointsToAward,
        "ai_solver",
        `Resolved doubt in session: ${session.title}`,
        aiMessage.id,
      );
    }
  }

  const responseSession = toSessionPayload(session);
  return {
    userMessage: toMessagePayload(userMessage),
    user_message: toMessagePayload(userMessage),
    aiMessage: toMessagePayload(aiMessage),
    ai_message: toMessagePayload(aiMessage),
    session: responseSession,
  };
}
