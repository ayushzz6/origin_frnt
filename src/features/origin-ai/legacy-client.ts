import {
  buildOriginAiPageContext,
  getOriginAiSession,
  sendOriginAiMessage,
} from "@/features/origin-ai/client";
import type { ChatMessage, DoubtSession, OriginAiReply, OriginAiSnapshot } from "@/types";

type SolverReply = {
  userMessage: ChatMessage;
  aiMessage: ChatMessage;
  session: DoubtSession;
};

const TITLE_STORAGE_KEY = "origin_ai_legacy_session_title";

function readStoredTitle(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(TITLE_STORAGE_KEY)?.trim();
  return value ? value : null;
}

function writeStoredTitle(title: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TITLE_STORAGE_KEY, title.trim());
}

function resolveTitle(snapshot: OriginAiSnapshot | OriginAiReply): string {
  return readStoredTitle() ?? snapshot.session.title ?? "AI Explainer";
}

function toDoubtSession(snapshot: OriginAiSnapshot | OriginAiReply): DoubtSession {
  return {
    id: snapshot.session.id,
    title: resolveTitle(snapshot),
    subject: "General",
    activeConcept: snapshot.pageContext.concept ?? snapshot.memory.lastWeakTopics[0] ?? null,
    messages: snapshot.session.messages,
    createdAt: snapshot.session.createdAt,
    updatedAt: snapshot.session.updatedAt,
  };
}

function buildDefaultContext() {
  return buildOriginAiPageContext("/doubt-solver");
}

export async function listDoubtSessions(): Promise<DoubtSession[]> {
  const snapshot = await getOriginAiSession(buildDefaultContext());
  return [toDoubtSession(snapshot)];
}

export async function createDoubtSession(payload: { title: string; subject: string }): Promise<DoubtSession> {
  const cleanedTitle = payload.title.trim() || `${payload.subject} Session`;
  writeStoredTitle(cleanedTitle);
  const snapshot = await getOriginAiSession(buildDefaultContext());
  return {
    ...toDoubtSession(snapshot),
    title: cleanedTitle,
  };
}

export async function updateDoubtSessionTitle(sessionId: string, title: string): Promise<DoubtSession> {
  const cleanedTitle = title.trim() || "AI Explainer";
  writeStoredTitle(cleanedTitle);
  const snapshot = await getOriginAiSession(buildDefaultContext());
  return {
    ...toDoubtSession(snapshot),
    id: sessionId || snapshot.session.id,
    title: cleanedTitle,
  };
}

export async function sendSolverMessage(
  sessionId: string,
  payload: { content?: string; image?: string },
): Promise<SolverReply> {
  const baseContent = payload.content?.trim();
  const content = payload.image
    ? `${baseContent ? `${baseContent}\n\n` : ""}I tried to upload an image for help. I can type the problem too if you need the exact text.`
    : baseContent;

  if (!content) {
    throw new Error("Message is required.");
  }

  const reply = await sendOriginAiMessage(content, buildDefaultContext());
  return {
    userMessage: reply.userMessage,
    aiMessage: reply.aiMessage,
    session: {
      ...toDoubtSession(reply),
      id: sessionId || reply.session.id,
    },
  };
}
