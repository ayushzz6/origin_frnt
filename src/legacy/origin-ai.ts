// Legacy Origin AI implementation kept intact while the public server module
// remains a small compatibility barrel.
import fs from "node:fs";
import path from "node:path";

import {
  getPracticeQuestionDetail,
  getTestDetail,
} from "@/server/assessments";
import { getOriginAiAnalyticsSnapshot, type OriginAiAnalyticsSnapshot } from "@/server/analytics-store";
import { awardPoints } from "@/server/gamification";
import {
  createId,
  type AppStore,
  type StoredChatMessage,
  type StoredOriginAiProfileMemory,
  type StoredOriginAiReminder,
  type StoredOriginAiSession,
  type StoredTestResult,
  type StoredUser,
} from "@/server/store";
import {
  createOriginAiLiveBootstrap,
  generateOriginAiProviderReply,
  normalizeVoiceTranscriptForChat,
  synthesizeOriginAiVoiceAudioSegments,
  transcribeOriginAiVoiceAudio,
  type OriginAiLiveBootstrapResponse,
  type OriginAiProviderRequest,
  type OriginAiVoiceSynthesisResponse,
} from "@/server/origin-ai-provider";
import { solveWithKnowledgeBase } from "@/server/ai-solver-kb";
import { dbUpdateUsageMetrics } from "@/server/db-users";

export type OriginAiPageKind =
  | "dashboard"
  | "dpp"
  | "test_active"
  | "test_result"
  | "tests_index"
  | "ogcode_question"
  | "ogcode_index"
  | "study_corner"
  | "pomodoro"
  | "profile"
  | "tasks"
  | "doubt_solver"
  | "unknown";

export type OriginAiPolicyMode = "normal" | "hint_only" | "answer_blocked";

interface OriginAiVisibleQuestionContext {
  id: string;
  number: number;
  title: string;
  chapter?: string | null;
  concept?: string | null;
  difficulty?: string | null;
  subject?: string | null;
  tags?: string[];
  isSolved?: boolean;
}

export interface OriginAiPageContextInput {
  pathname?: string | null;
  pageKind?: OriginAiPageKind | null;
  testId?: string | null;
  questionId?: string | null;
  questionTitle?: string | null;
  questionHint?: string | null;
  questionSolution?: string | null;
  questionExplanation?: string | null;
  questionSubject?: string | null;
  questionChapter?: string | null;
  questionConcept?: string | null;
  questionDifficulty?: string | null;
  questionAttempted?: boolean | null;
  questionSolved?: boolean | null;
  searchQuery?: string | null;
  activeSubject?: string | null;
  activeDifficulty?: string | null;
  activeStatus?: string | null;
  selectedChapters?: string[] | null;
  totalVisibleQuestions?: number | null;
  visibleQuestions?: OriginAiVisibleQuestionContext[] | null;
}

interface OriginAiResolvedPageContext {
  pathname: string;
  pageKind: OriginAiPageKind;
  testId: string | null;
  questionId: string | null;
  title: string | null;
  subject: string | null;
  chapter: string | null;
  concept: string | null;
  hint: string | null;
  questionAttempted: boolean | null;
  questionSolved: boolean | null;
  searchQuery: string | null;
  activeSubject: string | null;
  activeDifficulty: string | null;
  activeStatus: string | null;
  selectedChapters: string[];
  totalVisibleQuestions: number | null;
  visibleQuestions: OriginAiVisibleQuestionContext[];
}

interface OriginAiPolicy {
  mode: OriginAiPolicyMode;
  title: string;
  reason: string;
}

interface OriginAiMemoryPayload {
  preferredName: string;
  identitySummary: string;
  pinnedFacts: string[];
  lastWeakTopics: string[];
  pendingDppCount: number;
  pendingAssignmentCount: number;
  currentStreak: number;
  lastTestSummary: string | null;
  pendingDppFocusTopics?: string[];
  recentDppProgressSummary?: string | null;
}

export interface OriginAiSessionPayload {
  id: string;
  title: string;
  summary: string | null;
  lastPathname: string | null;
  lastPageKind: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
  threadId: string | null;
  subject: string | null;
  activeConcept: string | null;
}

export interface OriginAiThreadPayload {
  id: string;
  threadId: string;
  title: string;
  subject: string | null;
  activeConcept: string | null;
  lastPathname: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageSnippet: string | null;
}

export interface OriginAiSnapshotPayload {
  session: OriginAiSessionPayload;
  memory: OriginAiMemoryPayload;
  reminders: StoredOriginAiReminder[];
  pageContext: OriginAiResolvedPageContext;
  pagePolicy: OriginAiPolicy;
  provider: string;
}

export interface OriginAiReplyPayload extends OriginAiSnapshotPayload {
  userMessage: StoredChatMessage;
  aiMessage: StoredChatMessage;
}

export interface OriginAiVoiceConversationSeedTurn {
  role: "user" | "assistant";
  content: string;
}

export interface OriginAiVoiceBootstrapPayload extends OriginAiSnapshotPayload {
  browserSessionId: string;
  liveSystemInstruction?: string | null;
  contextSeed: string;
  conversationSeed: OriginAiVoiceConversationSeedTurn[];
  voice: OriginAiLiveBootstrapResponse;
}

export interface OriginAiVoiceReplyPayload extends OriginAiReplyPayload {
  userTranscript: string;
  assistantTranscript: string;
  voiceAudio: (OriginAiVoiceSynthesisResponse & { transport: "server_tts" }) | null;
}

export interface OriginAiVoiceSpeakPayload {
  voiceAudio: (OriginAiVoiceSynthesisResponse & { transport: "server_tts" }) | null;
  voiceAudioSegments: Array<OriginAiVoiceSynthesisResponse & { transport: "server_tts" }>;
  fallbackText: string | null;
  synthesisError?: string | null;
  totalDurationSeconds?: number;
}

const PROMPT_CACHE = new Map<string, string>();

function nowIso(): string {
  return new Date().toISOString();
}

function firstName(user: StoredUser): string {
  return user.name.trim().split(/\s+/)[0] || "there";
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function loadPromptDoc(fileName: string): string {
  const cacheKey = fileName;
  const cached = PROMPT_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const filePath = path.join(process.cwd(), "src", "origin-ai", fileName);
  const text = fs.readFileSync(filePath, "utf8");
  PROMPT_CACHE.set(cacheKey, text);
  return text;
}

function derivePathname(request: Request, input?: OriginAiPageContextInput | null): string {
  if (input?.pathname?.trim()) {
    return input.pathname.trim();
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return "/dashboard";
  }

  try {
    const url = new URL(referer);
    return url.pathname || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function inferPageKind(pathname: string, input?: OriginAiPageContextInput | null): OriginAiPageKind {
  if (input?.pageKind) {
    return input.pageKind;
  }

  if (/^\/tests\/[^/]+\/result$/.test(pathname)) {
    return "test_result";
  }
  if (/^\/tests\/[^/]+$/.test(pathname)) {
    return "test_active";
  }
  if (pathname === "/tests") {
    return "tests_index";
  }
  if (/^\/ogcode\/[^/]+$/.test(pathname)) {
    return "ogcode_question";
  }
  if (pathname === "/ogcode") {
    return "ogcode_index";
  }
  if (pathname === "/dashboard") {
    return "dashboard";
  }
  if (pathname === "/dpp") {
    return "dpp";
  }
  if (pathname === "/study-corner") {
    return "study_corner";
  }
  if (pathname === "/pomodoro") {
    return "pomodoro";
  }
  if (pathname === "/profile") {
    return "profile";
  }
  if (pathname === "/tasks") {
    return "tasks";
  }
  if (pathname === "/doubt-solver") {
    return "doubt_solver";
  }
  return "unknown";
}

function extractPathEntityId(pathname: string, prefix: string): string | null {
  const match = pathname.match(new RegExp(`^\\/${prefix}\\/([^/]+)`));
  return match?.[1] ?? null;
}

async function resolvePageContext(
  store: AppStore,
  user: StoredUser,
  request: Request,
  input?: OriginAiPageContextInput | null,
): Promise<OriginAiResolvedPageContext> {
  const pathname = derivePathname(request, input);
  const pageKind = inferPageKind(pathname, input);
  const testId = input?.testId ?? extractPathEntityId(pathname, "tests");
  const questionId = input?.questionId ?? extractPathEntityId(pathname, "ogcode");

  const context: OriginAiResolvedPageContext = {
    pathname,
    pageKind,
    testId,
    questionId,
    title: input?.questionTitle?.trim() || null,
    subject: input?.questionSubject?.trim() || null,
    chapter: input?.questionChapter?.trim() || null,
    concept: input?.questionConcept?.trim() || null,
    hint: input?.questionHint?.trim() || null,
    questionAttempted: input?.questionAttempted ?? null,
    questionSolved: input?.questionSolved ?? null,
    searchQuery: input?.searchQuery?.trim() || null,
    activeSubject: input?.activeSubject?.trim() || null,
    activeDifficulty: input?.activeDifficulty?.trim() || null,
    activeStatus: input?.activeStatus?.trim() || null,
    selectedChapters: input?.selectedChapters?.filter(Boolean) ?? [],
    totalVisibleQuestions: input?.totalVisibleQuestions ?? null,
    visibleQuestions: input?.visibleQuestions?.slice(0, 40) ?? [],
  };

  try {
    if (pageKind === "ogcode_question" && questionId) {
      const question = await getPracticeQuestionDetail(store, user, questionId);
      const attempts = store.practiceAttempts.filter(
        (attempt) => attempt.userId === user.id && attempt.questionId === questionId,
      );
      context.title = question.text;
      context.subject = question.subject ?? null;
      context.chapter = question.chapter ?? null;
      context.concept = question.concept ?? null;
      context.hint = question.hint ?? null;
      context.questionAttempted = context.questionAttempted ?? (attempts.length > 0);
      context.questionSolved =
        context.questionSolved ??
        (attempts.some((attempt) => attempt.isCorrect) || question.isSolved || question.status === "solved");
      return context;
    }

    if ((pageKind === "test_active" || pageKind === "test_result") && testId) {
      const test = await getTestDetail(store, user, testId);
      context.title = test.title;
      context.subject = test.subject ?? null;
      context.chapter = test.chapter ?? null;
      return context;
    }
  } catch {
    return context;
  }

  return context;
}

function resolvePagePolicy(pageContext: OriginAiResolvedPageContext): OriginAiPolicy {
  if (pageContext.pageKind === "test_active") {
    return {
      mode: "answer_blocked",
      title: "Integrity Mode",
      reason:
        "You are on a live test page, so Origin AI will not provide direct answers. It can help with time strategy, calming nerves, and what to review after submission.",
    };
  }

  if (pageContext.pageKind === "ogcode_question" && !pageContext.questionAttempted) {
    return {
      mode: "hint_only",
      title: "Hint Mode",
      reason:
        "You are on an OGCode practice question that has not been submitted yet, so Origin AI should coach with hints and concept nudges first. After you attempt it, Origin AI can switch into full mentor mode and explain the whole solution.",
    };
  }

  return {
    mode: "normal",
    title: "Mentor Mode",
    reason:
      pageContext.pageKind === "ogcode_question"
        ? "You are in OGCode practice mode, so Origin AI can coach, explain, and help you work through the current question like a mentor."
        : "Origin AI can coach, explain, plan revision, and help with study strategy here.",
  };
}

function getLatestResult(store: AppStore, userId: string): StoredTestResult | null {
  const results = store.testResults
    .filter((result) => result.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return results[0] ?? null;
}

function getOrCreateProfileMemory(store: AppStore, user: StoredUser): StoredOriginAiProfileMemory {
  let memory = store.originAiProfiles.find((entry) => entry.userId === user.id);
  if (!memory) {
    memory = {
      userId: user.id,
      preferredName: firstName(user),
      identitySummary: null,
      pinnedFacts: [],
      lastWeakTopics: [],
      lastTestResultId: null,
      lastVisitedPath: null,
      reminderDigest: [],
      updatedAt: nowIso(),
    };
    store.originAiProfiles.push(memory);
  }
  return memory;
}

function resolveBrowserSessionId(request: Request, user: StoredUser): string {
  const raw = request.headers.get("x-origin-ai-session-id")?.trim();
  if (raw) {
    return raw.slice(0, 128);
  }

  return `legacy-origin-ai-session-${user.id}`;
}

function getOrCreateMentorSession(
  store: AppStore,
  user: StoredUser,
  browserSessionId: string,
  threadId: string | null = null,
): StoredOriginAiSession {
  let session = store.originAiSessions.find((entry) =>
    threadId
      ? entry.userId === user.id && entry.threadId === threadId
      : entry.userId === user.id && entry.browserSessionId === browserSessionId && !entry.threadId,
  );
  if (!session) {
    const timestamp = nowIso();
    session = {
      id: createId("origin_ai"),
      userId: user.id,
      browserSessionId,
      title: threadId ? "Doubt Thread" : "Origin AI Mentor",
      summary: threadId ? null : "Persistent mentor chat for study guidance and revision planning.",
      lastPathname: null,
      lastPageKind: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      threadId,
      subject: null,
      activeConcept: null,
    };
    store.originAiSessions.push(session);
  }
  return session;
}

export function getThreadById(
  store: AppStore,
  userId: string,
  threadId: string,
): StoredOriginAiSession | null {
  return (
    store.originAiSessions.find(
      (entry) => entry.userId === userId && entry.threadId === threadId,
    ) ?? null
  );
}

export function listThreads(store: AppStore, userId: string): StoredOriginAiSession[] {
  return store.originAiSessions
    .filter((entry) => entry.userId === userId && entry.threadId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createThread(
  store: AppStore,
  userId: string,
  browserSessionId: string,
  payload: { title?: string; subject?: string | null },
): StoredOriginAiSession {
  const subject = payload.subject?.trim() ? payload.subject.trim().slice(0, 50) : null;
  const title = (payload.title?.trim() || `New ${subject ?? "Doubt"} Session`).slice(0, 255);
  const timestamp = nowIso();
  const session: StoredOriginAiSession = {
    id: createId("origin_ai"),
    userId,
    browserSessionId,
    title,
    summary: null,
    lastPathname: "/doubt-solver",
    lastPageKind: "doubt_solver",
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
    threadId: createId("thread"),
    subject,
    activeConcept: null,
  };
  store.originAiSessions.push(session);
  return session;
}

export function updateThread(
  store: AppStore,
  userId: string,
  threadId: string,
  payload: { title?: string; subject?: string | null },
): StoredOriginAiSession | null {
  const session = getThreadById(store, userId, threadId);
  if (!session) return null;
  if (typeof payload.title === "string" && payload.title.trim()) {
    session.title = payload.title.trim().slice(0, 255);
  }
  if (typeof payload.subject === "string" && payload.subject.trim()) {
    session.subject = payload.subject.trim().slice(0, 50);
  }
  session.updatedAt = nowIso();
  return session;
}

export function deleteThread(store: AppStore, userId: string, threadId: string): boolean {
  const originalLength = store.originAiSessions.length;
  store.originAiSessions = store.originAiSessions.filter(
    (entry) => !(entry.userId === userId && entry.threadId === threadId),
  );
  return store.originAiSessions.length !== originalLength;
}

function buildReminders(
  store: AppStore,
  user: StoredUser,
  latestResult: StoredTestResult | null,
  analyticsSnapshot: OriginAiAnalyticsSnapshot | null,
): StoredOriginAiReminder[] {
  const createdAt = nowIso();
  const reminders: StoredOriginAiReminder[] = [];

  const pendingDpps = store.dpps.filter((entry) => entry.userId === user.id && !entry.completed);
  for (const dpp of pendingDpps.slice(0, 3)) {
    reminders.push({
      id: `reminder_dpp_${dpp.id}`,
      userId: user.id,
      kind: "dpp",
      title: `Finish ${dpp.title}`,
      message: `You still have a pending ${titleCase(dpp.subject)} DPP. Small progress still counts, even if today is a one-question day.`,
      priority: "high",
      sourceId: dpp.id,
      createdAt,
    });
  }

  if (pendingDpps.length === 0 && analyticsSnapshot?.pendingDppCount) {
    for (const topic of analyticsSnapshot.pendingDppFocusTopics.slice(0, 3)) {
      reminders.push({
        id: `reminder_dpp_focus_${topic.replace(/\s+/g, "_").toLowerCase()}`,
        userId: user.id,
        kind: "dpp",
        title: `Practice ${topic}`,
        message: `A generated DPP is waiting on ${topic}. Knock out those weak spots before they start charging rent.`,
        priority: "high",
        sourceId: null,
        createdAt,
      });
    }
  }

  const revisionTopics =
    analyticsSnapshot?.latestWeakTopics.length
      ? analyticsSnapshot.latestWeakTopics.map((topic) => ({ topic, accuracy: 0 }))
      : (latestResult?.weakAreas ?? []);
  for (const weak of revisionTopics.slice(0, 3)) {
      reminders.push({
        id: `reminder_revision_${weak.topic.replace(/\s+/g, "_").toLowerCase()}`,
        userId: user.id,
        kind: "revision",
        title: `Revise ${weak.topic}`,
        message: `${weak.topic} was one of your weaker zones in the last test. A short revision sprint here will pay rent.`,
        priority: "high",
        sourceId: latestResult?.id ?? null,
        createdAt,
      });
  }

  const pendingAssignments = store.assignments.filter((entry) => entry.userId === user.id && !entry.completed);
  for (const assignment of pendingAssignments.slice(0, 2)) {
    reminders.push({
      id: `reminder_assignment_${assignment.id}`,
      userId: user.id,
      kind: "assignment",
      title: `Assignment pending: ${assignment.title}`,
      message: `Your ${titleCase(assignment.subject)} assignment is still pending${assignment.dueDate ? ` and due by ${new Date(assignment.dueDate).toLocaleDateString()}` : ""}.`,
      priority: "medium",
      sourceId: assignment.id,
      createdAt,
    });
  }

  reminders.push({
    id: `reminder_habit_${user.id}`,
    userId: user.id,
    kind: "habit",
    title: `Keep the streak breathing`,
    message: user.streak > 0
      ? `You are on a ${user.streak}-day streak. Protect it like it owes you money.`
      : "No active streak yet. One focused session today fixes that quickly.",
    priority: "low",
    sourceId: null,
    createdAt,
  });

  return reminders;
}

function syncProfileMemory(
  memory: StoredOriginAiProfileMemory,
  user: StoredUser,
  latestResult: StoredTestResult | null,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
): void {
  memory.preferredName = memory.preferredName?.trim() || firstName(user);
  memory.identitySummary = [
    `${user.name} is a ${user.role}`,
    user.selectedCourse ? `preparing for ${user.selectedCourse}` : null,
    user.studentClass ? `class ${user.studentClass}` : null,
    user.fieldOfInterest ? `targeting ${user.fieldOfInterest}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  memory.lastWeakTopics = latestResult?.weakAreas.slice(0, 5).map((row) => row.topic) ?? [];
  memory.lastTestResultId = latestResult?.id ?? null;
  memory.lastVisitedPath = pageContext.pathname;
  memory.reminderDigest = reminders.slice(0, 5).map((row) => row.title);
  memory.updatedAt = nowIso();
}

function buildMemoryPayload(
  memory: StoredOriginAiProfileMemory,
  user: StoredUser,
  latestResult: StoredTestResult | null,
  store: AppStore,
  analyticsSnapshot: OriginAiAnalyticsSnapshot | null,
): OriginAiMemoryPayload {
  return {
    preferredName: memory.preferredName?.trim() || firstName(user),
    identitySummary: memory.identitySummary?.trim() || `${user.name} is studying with Origin.`,
    pinnedFacts: memory.pinnedFacts,
    lastWeakTopics: analyticsSnapshot?.latestWeakTopics.length ? analyticsSnapshot.latestWeakTopics : memory.lastWeakTopics,
    pendingDppCount:
      analyticsSnapshot?.pendingDppCount ??
      store.dpps.filter((entry) => entry.userId === user.id && !entry.completed).length,
    pendingAssignmentCount: store.assignments.filter((entry) => entry.userId === user.id && !entry.completed).length,
    currentStreak: user.streak,
    lastTestSummary: analyticsSnapshot?.latestTestSummary ?? latestResult?.aiAnalysis.summary ?? null,
    pendingDppFocusTopics: analyticsSnapshot?.pendingDppFocusTopics ?? [],
    recentDppProgressSummary: analyticsSnapshot?.recentDppProgressSummary ?? null,
  };
}

interface OriginAiRuntimeState {
  browserSessionId: string;
  pageContext: OriginAiResolvedPageContext;
  pagePolicy: OriginAiPolicy;
  latestResult: StoredTestResult | null;
  analyticsSnapshot: OriginAiAnalyticsSnapshot | null;
  memoryRecord: StoredOriginAiProfileMemory;
  memoryPayload: OriginAiMemoryPayload;
  reminders: StoredOriginAiReminder[];
  session: StoredOriginAiSession;
}

async function prepareOriginAiRuntime(
  store: AppStore,
  user: StoredUser,
  request: Request,
  input?: OriginAiPageContextInput | null,
  threadId: string | null = null,
): Promise<OriginAiRuntimeState> {
  const browserSessionId = resolveBrowserSessionId(request, user);
  const pageContext = await resolvePageContext(store, user, request, input);
  const pagePolicy = resolvePagePolicy(pageContext);
  const latestResult = getLatestResult(store, user.id);
  const analyticsSnapshot = await getOriginAiAnalyticsSnapshot(user.id).catch(() => null);
  const memoryRecord = getOrCreateProfileMemory(store, user);
  const reminders = buildReminders(store, user, latestResult, analyticsSnapshot);
  syncProfileMemory(memoryRecord, user, latestResult, reminders, pageContext);
  const memoryPayload = buildMemoryPayload(memoryRecord, user, latestResult, store, analyticsSnapshot);

  store.originAiReminders = [
    ...store.originAiReminders.filter((entry) => entry.userId !== user.id),
    ...reminders,
  ];

  const session = getOrCreateMentorSession(store, user, browserSessionId, threadId);
  session.lastPathname = pageContext.pathname;
  session.lastPageKind = pageContext.pageKind;
  if (session.threadId && !session.subject && pageContext.activeSubject?.trim()) {
    session.subject = pageContext.activeSubject.trim().slice(0, 50);
  }
  // Skip the welcome bootstrap for named doubt threads — they start empty, subject-focused.
  if (!session.threadId) {
    ensureWelcomeTurn(session, user, memoryPayload, reminders, pagePolicy);
  }

  return {
    browserSessionId,
    pageContext,
    pagePolicy,
    latestResult,
    analyticsSnapshot,
    memoryRecord,
    memoryPayload,
    reminders,
    session,
  };
}

function serializeSession(session: StoredOriginAiSession): OriginAiSessionPayload {
  return {
    id: session.id,
    title: session.title,
    summary: session.summary,
    lastPathname: session.lastPathname,
    lastPageKind: session.lastPageKind,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: [...session.messages].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    threadId: session.threadId ?? null,
    subject: session.subject ?? null,
    activeConcept: session.activeConcept ?? null,
  };
}

export function serializeThread(session: StoredOriginAiSession): OriginAiThreadPayload {
  const sorted = [...session.messages].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const last = sorted[sorted.length - 1] ?? null;
  return {
    id: session.id,
    threadId: session.threadId ?? "",
    title: session.title,
    subject: session.subject ?? null,
    activeConcept: session.activeConcept ?? null,
    lastPathname: session.lastPathname,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: sorted.length,
    lastMessageSnippet: last ? last.content.slice(0, 160) : null,
  };
}

function buildConversationSeed(session: StoredOriginAiSession): OriginAiVoiceConversationSeedTurn[] {
  return [...session.messages]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-10)
    .filter((message) => message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function buildVoiceConversationContext(turns: OriginAiVoiceConversationSeedTurn[]): string | null {
  if (turns.length === 0) {
    return null;
  }

  const transcript = turns
    .slice(-8)
    .map((turn) => `${turn.role === "assistant" ? "Origin AI" : "Student"}: ${turn.content}`)
    .join("\n");

  return [
    "## Recent Conversation Context",
    "Use this as recent session memory for continuity.",
    "Do not quote it back unless relevant.",
    transcript,
  ].join("\n");
}

function buildVoiceContextSeed(
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
  pagePolicy: OriginAiPolicy,
): string {
  const visibleQuestions = pageContext.visibleQuestions
    .slice(0, 12)
    .map(
      (question) =>
        `#${question.number}: ${question.title} | ${question.subject ?? "Unknown subject"} | ${question.chapter ?? "Unknown chapter"} | ${question.concept ?? "Unknown concept"} | ${question.difficulty ?? "unknown"} | solved=${question.isSolved ? "yes" : "no"}`,
    )
    .join("\n");

  const reminderSummary = reminders
    .slice(0, 4)
    .map((reminder) => `- ${reminder.title}: ${reminder.message}`)
    .join("\n");

  return [
    "APP_CONTEXT_UPDATE",
    "This is live app context, not a student utterance.",
    "Use it as the current screen state for voice mode.",
    `Student: ${memory.preferredName}`,
    `Page kind: ${pageContext.pageKind}`,
    `Pathname: ${pageContext.pathname}`,
    `Policy mode: ${pagePolicy.mode}`,
    `Policy reason: ${pagePolicy.reason}`,
    pageContext.title ? `Current title/question: ${pageContext.title}` : null,
    pageContext.subject ? `Subject: ${pageContext.subject}` : null,
    pageContext.chapter ? `Chapter: ${pageContext.chapter}` : null,
    pageContext.concept ? `Concept: ${pageContext.concept}` : null,
    pageContext.questionAttempted !== null
      ? `Question attempted: ${pageContext.questionAttempted ? "yes" : "no"}`
      : null,
    pageContext.questionSolved !== null ? `Question solved: ${pageContext.questionSolved ? "yes" : "no"}` : null,
    pageContext.searchQuery ? `Search query: ${pageContext.searchQuery}` : null,
    pageContext.activeSubject ? `Active subject filter: ${pageContext.activeSubject}` : null,
    pageContext.activeDifficulty ? `Active difficulty filter: ${pageContext.activeDifficulty}` : null,
    pageContext.activeStatus ? `Active status filter: ${pageContext.activeStatus}` : null,
    pageContext.selectedChapters.length > 0
      ? `Selected chapters: ${pageContext.selectedChapters.join(", ")}`
      : null,
    pageContext.totalVisibleQuestions !== null
      ? `Visible question count: ${pageContext.totalVisibleQuestions}`
      : null,
    visibleQuestions ? `Visible questions:\n${visibleQuestions}` : null,
    memory.lastWeakTopics.length > 0 ? `Weak topics: ${memory.lastWeakTopics.join(", ")}` : null,
    reminderSummary ? `Live reminders:\n${reminderSummary}` : null,
    "If the student asks for a question recommendation, use the visible numbered questions above when available.",
    "Do not claim you cannot see the current page if the context above contains the needed screen state.",
    "If a current question/title/chapter/concept is present above, treat that as the screen currently in front of the student.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildWelcomeMessage(
  user: StoredUser,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pagePolicy: OriginAiPolicy,
): string {
  const topReminders = reminders.slice(0, 2).map((row) => row.title);
  const weakTopics = memory.lastWeakTopics.slice(0, 2);
  const pieces = [
    `Hey ${memory.preferredName}, I’m Origin AI.`,
    "I keep the useful study receipts, not the embarrassing ones.",
  ];

  if (weakTopics.length > 0) {
    pieces.push(`Last test wanted a rematch on ${weakTopics.join(" and ")}.`);
  }
  if (topReminders.length > 0) {
    pieces.push(`Right now I’d nudge you toward ${topReminders.join(" and ")}.`);
  }
  if (pagePolicy.mode !== "normal") {
    pieces.push(pagePolicy.reason);
  }

  pieces.push("Ask for a revision plan, concept help, or a quick study reset.");
  return pieces.join(" ");
}

function addAssistantMessage(session: StoredOriginAiSession, content: string, metadata: Record<string, unknown>) {
  session.messages.push({
    id: createId("origin_ai_msg"),
    role: "assistant",
    content,
    image: null,
    metadata,
    timestamp: nowIso(),
  });
  session.updatedAt = nowIso();
}

function ensureWelcomeTurn(
  session: StoredOriginAiSession,
  user: StoredUser,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pagePolicy: OriginAiPolicy,
): void {
  if (session.messages.length > 0) {
    return;
  }
  addAssistantMessage(session, buildWelcomeMessage(user, memory, reminders, pagePolicy), {
    source: "origin_ai_boot",
    provider: "local_fallback",
  });
}

function buildSystemInstruction(
  user: StoredUser,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
  pagePolicy: OriginAiPolicy,
  options?: { transport?: "text_chat" | "voice_mode" },
): string {
  const soul = loadPromptDoc("SOUL.md");
  const agent = loadPromptDoc("AGENT.md");
  const reminderSummary = reminders
    .slice(0, 5)
    .map((reminder) => `- [${reminder.priority}] ${reminder.title}: ${reminder.message}`)
    .join("\n");

  return [
    soul,
    agent,
    ...(options?.transport === "voice_mode"
      ? [
          "## Voice Mode Addendum",
          "- You are speaking, not writing.",
          "- Keep replies concise for casual chat, but when the student asks to explain, solve, or teach a question, give a complete spoken explanation in one turn.",
          "- For practice-question explanations, do not stop after only restating the givens or setting up variables. Finish the core explanation before ending the turn.",
          "- A complete explanation can be longer: usually 5 to 10 short spoken sentences, or a clear step-by-step walkthrough if needed.",
          "- When the student asks to explain the current OGCode question, do not switch into a Socratic checkpoint after step one. Complete the method first, then ask whether they want a recap or another version.",
          "- Do not end a question explanation on a dangling prompt like 'ab?', 'toh?', 'is ka matlab?', or 'try karoge?' before the actual reasoning is complete.",
          "- Sound like a warm, sharp mentor, not a narrator reading lecture notes.",
          "- Support both English and Hinglish in voice mode.",
          "- If the student speaks in Hinglish, reply in natural Hinglish using Roman script only.",
          "- Never use Devanagari or any other Indic script in voice transcripts.",
          "- If the student speaks in English, reply in English unless they ask you to switch.",
          "- Do not force Hinglish into every reply; mirror the student's language choice naturally.",
          "- If the current screen context already includes a title, question, chapter, concept, or visible question list, do not say you cannot see the screen.",
          "- Treat the provided page context as the student's live screen state.",
          "- Never say or transcript internal planning labels like 'Analyzing the Question', 'My plan is', 'I can see that the user needs', or similar hidden reasoning phrases.",
          "- Start with the actual answer directly. Do not narrate your thinking process before answering.",
          "- End only after a complete thought. Never stop in the middle of an explanation sentence unless the student actually interrupts you.",
          "- On OGCode practice pages, if the student asks for an explanation, include the actual reasoning steps and the key equation flow before you stop.",
          "- If page policy is hint_only or answer_blocked, obey it in voice exactly as in text.",
          "- If the student interrupts you mid-explanation, stop cleanly, answer the interruption first, then ask whether they want to continue the previous thread.",
          "- Voice replies should feel conversational and interactive, not like a paragraph being read aloud.",
        ]
      : []),
    "## Student Identity",
    `- Name: ${user.name}`,
    `- Role: ${user.role}`,
    `- Preferred name: ${memory.preferredName}`,
    `- Identity summary: ${memory.identitySummary}`,
    `- Selected course: ${user.selectedCourse ?? "unknown"}`,
    `- Streak: ${user.streak}`,
    memory.lastWeakTopics.length > 0
      ? `- Last weak topics: ${memory.lastWeakTopics.join(", ")}`
      : "- Last weak topics: none recorded",
    memory.lastTestSummary ? `- Last test summary: ${memory.lastTestSummary}` : "- Last test summary: none recorded",
    "## Live Reminders",
    reminderSummary || "- No reminders right now.",
    "## Current Page Context",
    `- Pathname: ${pageContext.pathname}`,
    `- Page kind: ${pageContext.pageKind}`,
    pageContext.title ? `- Page title/question: ${pageContext.title}` : "- Page title/question: unavailable",
    pageContext.subject ? `- Subject: ${pageContext.subject}` : "- Subject: unavailable",
    pageContext.chapter ? `- Chapter: ${pageContext.chapter}` : "- Chapter: unavailable",
    pageContext.concept ? `- Concept: ${pageContext.concept}` : "- Concept: unavailable",
    pageContext.hint ? `- Hint allowed on this page: ${pageContext.hint}` : "- Hint allowed on this page: unavailable",
    pageContext.questionAttempted !== null
      ? `- Question attempted: ${pageContext.questionAttempted ? "yes" : "no"}`
      : "- Question attempted: unknown",
    pageContext.questionSolved !== null
      ? `- Question solved: ${pageContext.questionSolved ? "yes" : "no"}`
      : "- Question solved: unknown",
    pageContext.searchQuery ? `- Search query: ${pageContext.searchQuery}` : "- Search query: none",
    pageContext.activeSubject ? `- Active subject filter: ${pageContext.activeSubject}` : "- Active subject filter: none",
    pageContext.activeDifficulty ? `- Active difficulty filter: ${pageContext.activeDifficulty}` : "- Active difficulty filter: none",
    pageContext.activeStatus ? `- Active status filter: ${pageContext.activeStatus}` : "- Active status filter: none",
    pageContext.selectedChapters.length > 0
      ? `- Selected chapters: ${pageContext.selectedChapters.join(", ")}`
      : "- Selected chapters: none",
    pageContext.totalVisibleQuestions !== null
      ? `- Visible question count: ${pageContext.totalVisibleQuestions}`
      : "- Visible question count: unavailable",
    pageContext.visibleQuestions.length > 0
      ? `- Visible questions:\n${pageContext.visibleQuestions
          .slice(0, 12)
          .map((question) => `  - #${question.number}: ${question.title} | ${question.chapter ?? "Unknown chapter"} | ${question.concept ?? "Unknown concept"} | ${question.difficulty ?? "unknown"} | solved=${question.isSolved ? "yes" : "no"}`)
          .join("\n")}`
      : "- Visible questions: unavailable",
    "## Page Policy",
    `- Mode: ${pagePolicy.mode}`,
    `- Reason: ${pagePolicy.reason}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildIntegrityReply(
  pageContext: OriginAiResolvedPageContext,
  memory: OriginAiMemoryPayload,
): string {
  return [
    `I’m in ${pageContext.pageKind === "test_active" ? "test" : "integrity"} mode right now, ${memory.preferredName}.`,
    "I won’t solve a live test question or hand over the direct answer while the attempt is active.",
    "What I *can* do:",
    "- help you calm the panic spiral",
    "- suggest a time-management move for the remaining section",
    "- tell you what to revise once you submit",
    "Tiny tough-love footnote: future-you likes honest marks more than suspiciously magical ones.",
  ].join("\n");
}

function buildHintOnlyReply(
  pageContext: OriginAiResolvedPageContext,
  memory: OriginAiMemoryPayload,
  userMessage: string,
): string {
  const hint = pageContext.hint?.trim() || `Start from the governing idea behind ${pageContext.concept ?? "this question"} before touching calculations.`;
  const concept = pageContext.concept ?? pageContext.chapter ?? "the current concept";
  const promptNudge = /answer|solve|final|direct/i.test(userMessage)
    ? "I’m keeping the final answer locked. You’re getting the coaching version, not the spoiler DLC."
    : "Good instinct. Let’s stay in hint mode and keep your attempt honest.";

  return [
    `${memory.preferredName}, I’m in OGCode hint mode.`,
    promptNudge,
    `Focus area: ${concept}.`,
    `Hint: ${hint}`,
    "Next best move: tell me which step feels foggy, and I’ll nudge only that step.",
  ].join("\n\n");
}

const QUESTION_INTENT_STOPWORDS = new Set([
  "which",
  "what",
  "should",
  "start",
  "with",
  "question",
  "questions",
  "number",
  "give",
  "show",
  "best",
  "first",
  "from",
  "into",
  "that",
  "this",
  "would",
  "like",
  "please",
  "need",
  "want",
  "about",
  "inside",
  "there",
  "their",
  "them",
  "have",
]);

const QUESTION_FOLLOW_UP_TOKENS = new Set([
  "hard",
  "harder",
  "easy",
  "easier",
  "medium",
  "another",
  "next",
  "more",
  "same",
  "similar",
  "else",
  "different",
  "tough",
  "tougher",
  "advanced",
  "challenging",
  "one",
  "ones",
]);

type OgcodeDifficultyPreference = "easy" | "medium" | "hard" | null;

interface OgcodeConversationAnchor {
  tokens: string[];
  label: string | null;
  questionNumber: number | null;
}

interface OgcodeIndexReply {
  content: string;
  metadata: Record<string, unknown>;
}

function tokenizeStudyQuery(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => token.length > 2 && !QUESTION_INTENT_STOPWORDS.has(token),
  );
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter(Boolean))];
}

function tokenizeTopicQuery(text: string): string[] {
  return uniqueTokens(
    tokenizeStudyQuery(text).filter((token) => !QUESTION_FOLLOW_UP_TOKENS.has(token)),
  );
}

function parseOgcodeDifficultyPreference(text: string): OgcodeDifficultyPreference {
  const normalized = text.toLowerCase();
  if (/\b(hard|harder|tough|tougher|advanced|challenging)\b/.test(normalized)) {
    return "hard";
  }
  if (/\b(easy|easier|simpler|basic|light)\b/.test(normalized)) {
    return "easy";
  }
  if (/\bmedium|moderate|balanced\b/.test(normalized)) {
    return "medium";
  }
  return null;
}

function isOgcodeRecommendationRequest(text: string): boolean {
  return /(which|what|give|show|start|begin|pick|question|number|solve|another|next|hard|harder|easy|easier|medium|tough|challenging)/i.test(
    text,
  );
}

function isOgcodeAlternativeRequest(text: string): boolean {
  return /\b(another|next|else|different|instead|more|harder|easier|similar)\b/i.test(text);
}

function readOgcodeAnchorFromMetadata(message: StoredChatMessage): OgcodeConversationAnchor | null {
  const recommendation =
    message.metadata && typeof message.metadata === "object"
      ? (message.metadata.ogcodeRecommendation as Record<string, unknown> | undefined)
      : undefined;

  if (!recommendation || typeof recommendation !== "object") {
    return null;
  }

  const rawTokens = Array.isArray(recommendation.anchorTokens) ? recommendation.anchorTokens : [];
  const tokens = uniqueTokens(
    rawTokens.filter((token): token is string => typeof token === "string").map((token) => token.toLowerCase()),
  );
  const label = typeof recommendation.anchorLabel === "string" ? recommendation.anchorLabel : null;
  const questionNumber =
    typeof recommendation.questionNumber === "number" ? recommendation.questionNumber : null;

  if (tokens.length === 0 && !label && questionNumber === null) {
    return null;
  }

  return {
    tokens,
    label,
    questionNumber,
  };
}

function inferOgcodeAnchorFromSession(
  session: StoredOriginAiSession,
  userMessage: string,
  pageContext: OriginAiResolvedPageContext,
): OgcodeConversationAnchor | null {
  const previousMessages = [...session.messages];
  const latest = previousMessages.at(-1);
  if (latest?.role === "user" && latest.content.trim() === userMessage.trim()) {
    previousMessages.pop();
  }

  for (let index = previousMessages.length - 1; index >= 0; index -= 1) {
    const message = previousMessages[index];
    if (message.role === "assistant") {
      const anchored = readOgcodeAnchorFromMetadata(message);
      if (anchored) {
        return anchored;
      }
      continue;
    }

    const tokens = tokenizeTopicQuery(message.content);
    if (tokens.length > 0) {
      return {
        tokens,
        label: null,
        questionNumber: null,
      };
    }
  }

  const fallbackTokens = uniqueTokens(
    [
      pageContext.activeSubject,
      ...pageContext.selectedChapters,
      pageContext.searchQuery ?? "",
    ]
      .flatMap((value) => tokenizeTopicQuery(value ?? ""))
      .filter(Boolean),
  );

  if (fallbackTokens.length === 0) {
    return null;
  }

  return {
    tokens: fallbackTokens,
    label: pageContext.selectedChapters[0] ?? pageContext.activeSubject ?? null,
    questionNumber: null,
  };
}

function difficultyWeight(value?: string | null): number {
  switch ((value ?? "").toLowerCase()) {
    case "easy":
      return 1;
    case "medium":
      return 2;
    case "hard":
      return 3;
    case "insane":
      return 4;
    default:
      return 5;
  }
}

function scoreVisibleQuestion(question: OriginAiVisibleQuestionContext, tokens: string[]): number {
  const haystack = [
    question.title,
    question.chapter,
    question.concept,
    question.subject,
    ...(question.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

function scoreDifficultyPreference(
  question: OriginAiVisibleQuestionContext,
  preference: OgcodeDifficultyPreference,
): number {
  if (!preference) {
    return 0;
  }

  const weight = difficultyWeight(question.difficulty);
  switch (preference) {
    case "hard":
      return weight >= 3 ? 4 + weight : -(3 - weight);
    case "medium":
      return 4 - Math.abs(weight - 2);
    case "easy":
      return weight === 1 ? 5 : 3 - Math.abs(weight - 1);
    default:
      return 0;
  }
}

function buildAnchorLabel(question: OriginAiVisibleQuestionContext, anchor: OgcodeConversationAnchor | null): string | null {
  return (
    anchor?.label ??
    question.concept ??
    question.chapter ??
    question.subject ??
    null
  );
}

function buildOgcodeIndexReply(
  session: StoredOriginAiSession,
  pageContext: OriginAiResolvedPageContext,
  memory: OriginAiMemoryPayload,
  userMessage: string,
): OgcodeIndexReply | null {
  if (pageContext.pageKind !== "ogcode_index" || pageContext.visibleQuestions.length === 0) {
    return null;
  }

  if (!isOgcodeRecommendationRequest(userMessage)) {
    return null;
  }

  const explicitTokens = tokenizeTopicQuery(userMessage);
  const anchor = explicitTokens.length > 0
    ? {
        tokens: explicitTokens,
        label: null,
        questionNumber: null,
      }
    : inferOgcodeAnchorFromSession(session, userMessage, pageContext);
  const anchorTokens = anchor?.tokens ?? [];
  const difficultyPreference = parseOgcodeDifficultyPreference(userMessage);
  const wantsAlternative = isOgcodeAlternativeRequest(userMessage);

  const ranked = pageContext.visibleQuestions
    .map((question) => ({
      question,
      topicScore: scoreVisibleQuestion(question, anchorTokens),
      difficultyScore: scoreDifficultyPreference(question, difficultyPreference),
    }))
    .sort((left, right) => {
      if (right.topicScore !== left.topicScore) {
        return right.topicScore - left.topicScore;
      }

      if (right.difficultyScore !== left.difficultyScore) {
        return right.difficultyScore - left.difficultyScore;
      }

      if ((left.question.isSolved ? 1 : 0) !== (right.question.isSolved ? 1 : 0)) {
        return (left.question.isSolved ? 1 : 0) - (right.question.isSolved ? 1 : 0);
      }

      if (difficultyWeight(left.question.difficulty) !== difficultyWeight(right.question.difficulty)) {
        return difficultyWeight(left.question.difficulty) - difficultyWeight(right.question.difficulty);
      }

      return left.question.number - right.question.number;
    });

  const primary = ranked.find(({ question }) => !wantsAlternative || question.number !== anchor?.questionNumber)?.question
    ?? ranked[0]?.question;
  const topTopicScore = ranked[0]?.topicScore ?? 0;

  if (explicitTokens.length > 0 && topTopicScore <= 0) {
    const requestedTopic = explicitTokens.join(" ");
    const filterSummary = [
      pageContext.activeSubject ? pageContext.activeSubject : null,
      pageContext.activeDifficulty ? `${pageContext.activeDifficulty} difficulty` : null,
      pageContext.activeStatus ? `${pageContext.activeStatus} only` : null,
      pageContext.selectedChapters.length > 0 ? pageContext.selectedChapters.join(", ") : null,
      pageContext.searchQuery ? `search: "${pageContext.searchQuery}"` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    return {
      content: [
        `I can’t see a visible OGCode question that clearly matches "${requestedTopic}" right now.`,
        filterSummary
          ? `Your current OGCode view is filtered as: ${filterSummary}.`
          : "Your current OGCode view is broad enough that the topic signal is getting diluted.",
        "Best move: set the subject or search to that topic first, then ask me again and I’ll point you to the exact question number instead of guessing.",
      ].join("\n\n"),
      metadata: {
        source: "origin_ai_ogcode_index_router",
        ogcodeRecommendation: {
          questionId: null,
          questionNumber: null,
          anchorLabel: requestedTopic,
          anchorTokens: explicitTokens,
          difficultyPreference,
          unmatchedTopic: true,
        },
      },
    };
  }

  if (!primary) {
    return null;
  }

  const backups = ranked
    .slice(1, 3)
    .map(({ question }) => `#${question.number} (${question.concept ?? question.chapter ?? question.title})`);

  const filterSummary = [
    pageContext.activeSubject ? pageContext.activeSubject : null,
    pageContext.activeDifficulty ? `${pageContext.activeDifficulty} difficulty` : null,
    pageContext.activeStatus ? `${pageContext.activeStatus} only` : null,
    pageContext.selectedChapters.length > 0 ? pageContext.selectedChapters.join(", ") : null,
    pageContext.searchQuery ? `search: "${pageContext.searchQuery}"` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const anchorLabel = buildAnchorLabel(primary, anchor);
  const intro = difficultyPreference === "hard"
    ? `For a harder pick${anchorLabel ? ` in ${anchorLabel}` : ""}, start with question #${primary.number}.`
    : difficultyPreference === "easy"
      ? `For an easier warm-up${anchorLabel ? ` in ${anchorLabel}` : ""}, start with question #${primary.number}.`
      : difficultyPreference === "medium"
        ? `For a balanced pick${anchorLabel ? ` in ${anchorLabel}` : ""}, start with question #${primary.number}.`
        : anchorLabel && explicitTokens.length === 0
          ? `Staying in ${anchorLabel}, start with question #${primary.number}.`
          : `Start with question #${primary.number}.`;

  const whyLine = anchorLabel
    ? `Why this one: it keeps you inside ${anchorLabel} and lines up with ${primary.chapter ?? "the current chapter"} and ${primary.concept ?? "the current concept"}.`
    : `Why this one: it sits in ${primary.chapter ?? "the current chapter"} and ${primary.concept ?? "the current concept"}, so it is the cleanest entry point from what you are seeing right now.`;

  return {
    content: [
      intro,
      `${primary.title}`,
      whyLine,
      filterSummary ? `I’m basing that on your current OGCode filters: ${filterSummary}.` : null,
      backups.length > 0 ? `If that one feels too light or too noisy, go next to ${backups.join(" or ")}.` : null,
      `Short version, ${memory.preferredName}: no guessing here, start with #${primary.number}.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    metadata: {
      source: "origin_ai_ogcode_index_router",
      ogcodeRecommendation: {
        questionId: primary.id,
        questionNumber: primary.number,
        anchorLabel,
        anchorTokens,
        difficultyPreference,
        chapter: primary.chapter ?? null,
        concept: primary.concept ?? null,
        subject: primary.subject ?? null,
      },
    },
  };
}

function buildLocalMentorReply(
  session: StoredOriginAiSession,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
  userMessage: string,
): string {
  const text = userMessage.toLowerCase();
  const weakTopics = memory.lastWeakTopics.slice(0, 3);
  const ogcodeIndexReply = buildOgcodeIndexReply(session, pageContext, memory, userMessage);

  if (ogcodeIndexReply) {
    return ogcodeIndexReply.content;
  }

  if (/(plan|schedule|what should i do|what now|priority)/.test(text)) {
    const todo = reminders.slice(0, 3).map((row, index) => `${index + 1}. ${row.title} - ${row.message}`);
    return [
      `Here’s the cleanest next-step plan, ${memory.preferredName}:`,
      ...(todo.length > 0 ? todo : ["1. Do one short focused revision block.", "2. Solve one practice question.", "3. Close the loop with a recap."]),
      "If you want, I can compress this into a 20-minute rescue plan instead of a full study block.",
    ].join("\n");
  }

  if (/(weak|revise|revision|mistake|last test|where did i mess up)/.test(text) && weakTopics.length > 0) {
    return [
      `Your latest weak topics were ${weakTopics.join(", ")}.`,
      memory.lastTestSummary ?? "The last result says there is room to tighten conceptual accuracy.",
      "Pick one of those topics and I’ll break it into: core idea, common trap, and a fast revision drill.",
    ].join("\n\n");
  }

  if (pageContext.pageKind === "dpp") {
    return [
      `You’re on the DPP page, ${memory.preferredName}.`,
      `Pending DPP count: ${memory.pendingDppCount}.`,
      "Best move here: finish one incomplete set before jumping to a new shiny topic. Your brain prefers closure even when your tabs do not.",
    ].join("\n\n");
  }

  if (pageContext.pageKind === "study_corner") {
    return [
      "You’re in Study Corner.",
      "Ask me to build a revision plan for a chapter, turn a topic into quick bullet notes, or decide what to read next.",
    ].join("\n\n");
  }

  return [
    `Hey ${memory.preferredName}, I’ve got your study context loaded.`,
    memory.pendingDppCount > 0
      ? `You still have ${memory.pendingDppCount} pending DPP${memory.pendingDppCount === 1 ? "" : "s"}.`
      : "No pending DPP emergencies at the moment.",
    weakTopics.length > 0
      ? `The last weak-topic trail points to ${weakTopics.join(", ")}.`
      : "I don’t have a weak-topic alert from your last test yet.",
    "Tell me whether you want concept help, a revision plan, or a reminder list and I’ll keep it tight.",
  ].join(" ");
}

function maybeUpdatePinnedFacts(memory: StoredOriginAiProfileMemory, userMessage: string): void {
  const preferredNameMatch = userMessage.match(/\bcall me\s+([a-z][a-z\s'-]{1,30})/i);
  if (preferredNameMatch) {
    memory.preferredName = preferredNameMatch[1].trim().replace(/\s+/g, " ");
  }

  const remindMeMatch = userMessage.match(/\bremind me to\s+(.{3,80})/i);
  if (remindMeMatch) {
    const reminder = remindMeMatch[1].trim().replace(/[.?!]+$/, "");
    if (reminder && !memory.pinnedFacts.includes(`Reminder: ${reminder}`)) {
      memory.pinnedFacts = [`Reminder: ${reminder}`, ...memory.pinnedFacts].slice(0, 8);
    }
  }
}

async function generateAssistantReply(
  user: StoredUser,
  session: StoredOriginAiSession,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
  pagePolicy: OriginAiPolicy,
  userMessage: string,
  transport: "text_chat" | "voice_mode" = "text_chat",
): Promise<{ content: string; provider: string; model: string; metadata: Record<string, unknown> }> {
  if (pagePolicy.mode === "answer_blocked") {
    return {
      content: buildIntegrityReply(pageContext, memory),
      provider: "local_fallback",
      model: "guardrail",
      metadata: { mode: pagePolicy.mode, source: "origin_ai_guardrail" },
    };
  }

  if (pagePolicy.mode === "hint_only") {
    return {
      content: buildHintOnlyReply(pageContext, memory, userMessage),
      provider: "local_fallback",
      model: "hint_guardrail",
      metadata: { mode: pagePolicy.mode, source: "origin_ai_hint_guardrail" },
    };
  }

  const ogcodeIndexReply = buildOgcodeIndexReply(session, pageContext, memory, userMessage);
  if (ogcodeIndexReply) {
    return {
      content: ogcodeIndexReply.content,
      provider: "local_context",
      model: "ogcode_index_router",
      metadata: ogcodeIndexReply.metadata,
    };
  }

  let kbFallbackReply: ReturnType<typeof solveWithKnowledgeBase> | null = null;

  // Doubt Solver named threads are subject-scoped academic Q&A — route through
  // the local KB first. This is the brain that actually answers "explain
  // Carnot Cycle", and it doesn't burn LLM tokens. Falls through to the
  // provider/local-mentor when the KB isn't confident (kbResolved === false),
  // so non-academic questions like "what are my weaknesses" still get a real
  // mentor reply instead of the KB clarifier ("I need exact subject + concept…").
  if (session.threadId && pageContext.pageKind === "doubt_solver") {
    try {
      const kbReply = solveWithKnowledgeBase({
        sessionTitle: session.title,
        sessionSubject: pageContext.activeSubject ?? session.subject ?? "",
        activeConcept: session.activeConcept,
        studentInput: userMessage,
        image: null,
      });
      const kbResolved = kbReply.metadata.kbResolved !== false;
      if (kbResolved && kbReply.content.trim()) {
        if (typeof kbReply.metadata.subject === "string" && !session.subject) {
          session.subject = kbReply.metadata.subject;
        }
        if (kbReply.activeConcept) {
          session.activeConcept = kbReply.activeConcept;
        }
        return {
          content: kbReply.content,
          provider: "local_kb",
          model: "ai-solver-kb",
          metadata: { source: "ai_solver_kb", ...kbReply.metadata },
        };
      }
      if (kbReply.content.trim()) {
        kbFallbackReply = kbReply;
      }
    } catch (err) {
      console.error("[origin-ai] KB lookup failed, falling through to provider", err);
    }
  }

  const history = session.messages.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const providerRequest: OriginAiProviderRequest = {
    requestId: createId("origin_ai_req"),
    systemInstruction: buildSystemInstruction(user, memory, reminders, pageContext, pagePolicy, {
      transport,
    }),
    conversation: [...history, { role: "user", content: userMessage }],
    maxOutputTokens: transport === "voice_mode" ? 1100 : 700,
  };

  const providerReply = await generateOriginAiProviderReply(providerRequest);
  if (providerReply?.content.trim()) {
    return {
      content: providerReply.content.trim(),
      provider: providerReply.provider,
      model: providerReply.model,
      metadata: providerReply.metadata ?? {},
    };
  }

  if (kbFallbackReply?.content.trim()) {
    return {
      content: kbFallbackReply.content.trim(),
      provider: "local_kb",
      model: "ai-solver-kb-clarifier",
      metadata: { source: "ai_solver_kb", ...kbFallbackReply.metadata },
    };
  }

  return {
    content: buildLocalMentorReply(session, memory, reminders, pageContext, userMessage),
    provider: "local_fallback",
    model: "local-context-mentor",
    metadata: { source: "origin_ai_local_fallback" },
  };
}

function maybeAwardOriginAiPoints(store: AppStore, user: StoredUser, referenceId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const awardedToday = store.pointLogs
    .filter((entry) => entry.userId === user.id && entry.activityType === "origin_ai" && entry.timestamp.slice(0, 10) === today)
    .reduce((total, entry) => total + entry.points, 0);

  if (awardedToday >= 25) {
    return;
  }

  const points = Math.min(5, 25 - awardedToday);
  if (points <= 0) {
    return;
  }

  awardPoints(store, user.id, points, "origin_ai", "Checked in with Origin AI mentor", referenceId);
}

export async function getOriginAiSnapshot(
  store: AppStore,
  user: StoredUser,
  request: Request,
  input?: OriginAiPageContextInput | null,
  threadId: string | null = null,
): Promise<OriginAiSnapshotPayload> {
  const runtime = await prepareOriginAiRuntime(store, user, request, input, threadId);

  return {
    session: serializeSession(runtime.session),
    memory: runtime.memoryPayload,
    reminders: runtime.reminders,
    pageContext: runtime.pageContext,
    pagePolicy: runtime.pagePolicy,
    provider: "bootstrap",
  };
}

export async function getOriginAiVoiceBootstrap(
  store: AppStore,
  user: StoredUser,
  request: Request,
  input?: OriginAiPageContextInput | null,
): Promise<OriginAiVoiceBootstrapPayload | { error: string }> {
  const runtime = await prepareOriginAiRuntime(store, user, request, input);
  const contextSeed = buildVoiceContextSeed(
    runtime.memoryPayload,
    runtime.reminders,
    runtime.pageContext,
    runtime.pagePolicy,
  );
  const conversationSeed = buildConversationSeed(runtime.session);
  const voiceSystemInstruction = [
    buildSystemInstruction(
      user,
      runtime.memoryPayload,
      runtime.reminders,
      runtime.pageContext,
      runtime.pagePolicy,
      { transport: "voice_mode" },
    ),
    "## Live Screen Context",
    contextSeed,
    buildVoiceConversationContext(conversationSeed),
  ].join("\n");
  let voice: OriginAiLiveBootstrapResponse;
  try {
    voice = await createOriginAiLiveBootstrap({
      systemInstruction: voiceSystemInstruction,
      requestId: createId("origin_ai_voice"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Origin AI voice mode is not configured yet.";
    return { error: message };
  }

  return {
    session: serializeSession(runtime.session),
    memory: runtime.memoryPayload,
    reminders: runtime.reminders,
    pageContext: runtime.pageContext,
    pagePolicy: runtime.pagePolicy,
    provider: "voice_bootstrap",
    browserSessionId: runtime.browserSessionId,
    liveSystemInstruction: voiceSystemInstruction,
    contextSeed,
    conversationSeed,
    voice,
  };
}

interface OriginAiVoiceTurnInput {
  userTranscript: string;
  assistantTranscript: string;
  liveSessionId?: string | null;
  responseId?: string | null;
  model?: string | null;
  transport?: "gemini_live";
  interrupted?: boolean;
  completionReason?: "turn_complete" | "interrupted" | "manual_stop" | "unknown";
  assistantAudioChunkCount?: number;
  assistantTranscriptChunkCount?: number;
  assistantTextPartChunkCount?: number;
  hadOutputTranscript?: boolean;
}

interface OriginAiVoiceAudioInput {
  audioData: string;
  mimeType: string;
  voiceName?: string | null;
}

interface OriginAiVoiceSpeakInput {
  text: string;
  voiceName?: string | null;
}

interface SendOriginAiMessageOptions {
  transport?: "text_chat" | "voice_mode";
  userMetadata?: Record<string, unknown>;
  assistantMetadata?: Record<string, unknown>;
  threadId?: string | null;
}

export async function commitOriginAiVoiceTurn(
  store: AppStore,
  user: StoredUser,
  request: Request,
  voiceTurn: OriginAiVoiceTurnInput,
  input?: OriginAiPageContextInput | null,
): Promise<OriginAiReplyPayload | { error: string }> {
  const rawUserTranscript = voiceTurn.userTranscript.trim();
  const rawAssistantTranscript = voiceTurn.assistantTranscript.trim();

  if (!rawUserTranscript) {
    return { error: "Voice transcript is required." };
  }
  if (!rawAssistantTranscript) {
    return { error: "Origin AI reply transcript is required." };
  }

  const [userTranscript, assistantTranscript] = await Promise.all([
    normalizeVoiceTranscriptForChat(rawUserTranscript, "user"),
    normalizeVoiceTranscriptForChat(rawAssistantTranscript, "assistant"),
  ]);

  if (!userTranscript.trim()) {
    return { error: "Voice transcript is required." };
  }
  if (!assistantTranscript.trim()) {
    return { error: "Origin AI reply transcript is required." };
  }

  const runtime = await prepareOriginAiRuntime(store, user, request, input);
  maybeUpdatePinnedFacts(runtime.memoryRecord, userTranscript);

  const userMessage: StoredChatMessage = {
    id: createId("origin_ai_msg"),
    role: "user",
    content: userTranscript,
    image: null,
    metadata: {
      pathname: runtime.pageContext.pathname,
      pageKind: runtime.pageContext.pageKind,
      source: "origin_ai_voice",
      transport: voiceTurn.transport ?? "gemini_live",
      liveSessionId: voiceTurn.liveSessionId ?? null,
      responseId: voiceTurn.responseId ?? null,
      interrupted: voiceTurn.interrupted ?? false,
      completionReason: voiceTurn.completionReason ?? "unknown",
      assistantAudioChunkCount: voiceTurn.assistantAudioChunkCount ?? 0,
      assistantTranscriptChunkCount: voiceTurn.assistantTranscriptChunkCount ?? 0,
      assistantTextPartChunkCount: voiceTurn.assistantTextPartChunkCount ?? 0,
      hadOutputTranscript: voiceTurn.hadOutputTranscript ?? false,
    },
    timestamp: nowIso(),
  };

  const aiMessage: StoredChatMessage = {
    id: createId("origin_ai_msg"),
    role: "assistant",
    content: assistantTranscript,
    image: null,
    metadata: {
      source: "origin_ai",
      provider: "gemini",
      model: voiceTurn.model ?? process.env.GEMINI_LIVE_MODEL?.trim() ?? "gemini-live-2.5-flash-preview",
      pageKind: runtime.pageContext.pageKind,
      policyMode: runtime.pagePolicy.mode,
      transport: voiceTurn.transport ?? "gemini_live",
      liveSessionId: voiceTurn.liveSessionId ?? null,
      responseId: voiceTurn.responseId ?? null,
      interrupted: voiceTurn.interrupted ?? false,
      completionReason: voiceTurn.completionReason ?? "unknown",
      assistantAudioChunkCount: voiceTurn.assistantAudioChunkCount ?? 0,
      assistantTranscriptChunkCount: voiceTurn.assistantTranscriptChunkCount ?? 0,
      assistantTextPartChunkCount: voiceTurn.assistantTextPartChunkCount ?? 0,
      hadOutputTranscript: voiceTurn.hadOutputTranscript ?? false,
      modality: "voice",
    },
    timestamp: nowIso(),
  };

  runtime.session.messages.push(userMessage, aiMessage);
  runtime.session.updatedAt = nowIso();
  maybeAwardOriginAiPoints(store, user, aiMessage.id);

  return {
    userMessage,
    aiMessage,
    session: serializeSession(runtime.session),
    memory: buildMemoryPayload(
      runtime.memoryRecord,
      user,
      runtime.latestResult,
      store,
      runtime.analyticsSnapshot,
    ),
    reminders: runtime.reminders,
    pageContext: runtime.pageContext,
    pagePolicy: runtime.pagePolicy,
    provider: "gemini",
  };
}

export async function respondOriginAiVoiceTurn(
  store: AppStore,
  user: StoredUser,
  request: Request,
  voiceInput: OriginAiVoiceAudioInput,
  input?: OriginAiPageContextInput | null,
): Promise<OriginAiVoiceReplyPayload | { error: string }> {
  const audioData = voiceInput.audioData.trim();
  const mimeType = voiceInput.mimeType.trim();

  if (!audioData) {
    return { error: "Voice audio payload is required." };
  }
  if (!mimeType) {
    return { error: "Voice audio mime type is required." };
  }

  let rawTranscript: string;
  let transcriptionModel: string;

  try {
    const transcription = await transcribeOriginAiVoiceAudio(
      audioData,
      mimeType,
      createId("origin_ai_voice_stt"),
    );
    rawTranscript = transcription.transcript;
    transcriptionModel = transcription.model;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Origin AI could not transcribe the voice message.",
    };
  }

  const userTranscript = await normalizeVoiceTranscriptForChat(rawTranscript, "user");
  if (!userTranscript.trim()) {
    return { error: "Origin AI could not understand the voice message clearly enough." };
  }

  const reply = await sendOriginAiMessage(
    store,
    user,
    request,
    userTranscript,
    input,
    {
      transport: "voice_mode",
      userMetadata: {
        source: "origin_ai_voice",
        modality: "voice",
        audioMimeType: mimeType,
        transcriptionModel,
      },
      assistantMetadata: {
        modality: "voice",
        transcriptionModel,
      },
    },
  );

  if ("error" in reply) {
    return reply;
  }

  return {
    ...reply,
    userTranscript,
    assistantTranscript: reply.aiMessage.content,
    voiceAudio: null,
  };
}

export async function speakOriginAiVoiceText(
  voiceInput: OriginAiVoiceSpeakInput,
): Promise<OriginAiVoiceSpeakPayload> {
  const text = voiceInput.text.trim();
  if (!text) {
    return {
      voiceAudio: null,
      voiceAudioSegments: [],
      fallbackText: null,
      synthesisError: "Origin AI voice text is required.",
    };
  }

  const requestId = createId("origin_ai_voice_tts");

  try {
    const audioSegments = await synthesizeOriginAiVoiceAudioSegments(
      text,
      requestId,
      voiceInput.voiceName ?? null,
    );
    const transportedSegments = audioSegments.map((audio) => ({
      ...audio,
      transport: "server_tts" as const,
    }));

    const totalDurationSeconds = audioSegments.reduce((sum, seg) => sum + (seg.duration ?? 0), 0);

    return {
      voiceAudio: transportedSegments[0] ?? null,
      voiceAudioSegments: transportedSegments,
      fallbackText: text,
      totalDurationSeconds,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Origin AI could not synthesize the voice reply.";
    console.error(`[OriginAI TTS] speakOriginAiVoiceText failed (req=${requestId}): ${detail}`);
    // Return a successful payload with no audio so the client can use
    // browser speech fallback instead of receiving a 400.
    return {
      voiceAudio: null,
      voiceAudioSegments: [],
      fallbackText: text,
      synthesisError: detail,
    };
  }
}

export async function sendOriginAiMessage(
  store: AppStore,
  user: StoredUser,
  request: Request,
  userContent: string,
  input?: OriginAiPageContextInput | null,
  options?: SendOriginAiMessageOptions,
): Promise<OriginAiReplyPayload | { error: string }> {
  const trimmed = userContent.trim();
  if (!trimmed) {
    return { error: "Message is required." };
  }

  // Check usage and daily limits (10 mins voice, 200k tokens)
  // We call dbUpdateUsageMetrics with 0 increments to handle the daily reset and get fresh counts.
  const currentUsage = await dbUpdateUsageMetrics(user.id, { tokens: 0, voiceMinutes: 0 });
  const isVoiceMode = (options?.transport ?? "text_chat") === "voice_mode";

  if (currentUsage.tokensUsedToday >= 200000) {
    return { error: "DAILY_TOKEN_LIMIT_EXCEEDED" };
  }

  const isExplainer = input?.pageKind === "doubt_solver";
  if (isVoiceMode && currentUsage.voiceMinutesUsedToday >= 10 && !isExplainer) {
    return { error: "DAILY_VOICE_LIMIT_EXCEEDED" };
  }

  const runtime = await prepareOriginAiRuntime(store, user, request, input, options?.threadId ?? null);
  maybeUpdatePinnedFacts(runtime.memoryRecord, trimmed);

  const userMessage: StoredChatMessage = {
    id: createId("origin_ai_msg"),
    role: "user",
    content: trimmed,
    image: null,
    metadata: {
      pathname: runtime.pageContext.pathname,
      pageKind: runtime.pageContext.pageKind,
      transport: options?.transport ?? "text_chat",
      ...options?.userMetadata,
    },
    timestamp: nowIso(),
  };
  runtime.session.messages.push(userMessage);

  const assistantTurn = await generateAssistantReply(
    user,
    runtime.session,
    runtime.memoryPayload,
    runtime.reminders,
    runtime.pageContext,
    runtime.pagePolicy,
    trimmed,
    options?.transport ?? "text_chat",
  );

  const aiMessage: StoredChatMessage = {
    id: createId("origin_ai_msg"),
    role: "assistant",
    content: assistantTurn.content,
    image: null,
    metadata: {
      source: "origin_ai",
      provider: assistantTurn.provider,
      model: assistantTurn.model,
      pageKind: runtime.pageContext.pageKind,
      policyMode: runtime.pagePolicy.mode,
      transport: options?.transport ?? "text_chat",
      ...assistantTurn.metadata,
      ...options?.assistantMetadata,
    },
    timestamp: nowIso(),
  };

  runtime.session.messages.push(aiMessage);
  runtime.session.updatedAt = nowIso();

  // Track token usage
  const totalTokens = (assistantTurn.metadata?.usage as any)?.totalTokens || 0;
  if (totalTokens > 0) {
    await dbUpdateUsageMetrics(user.id, { tokens: totalTokens });
  }

  maybeAwardOriginAiPoints(store, user, aiMessage.id);

  return {
    userMessage,
    aiMessage,
    session: serializeSession(runtime.session),
    memory: buildMemoryPayload(
      runtime.memoryRecord,
      user,
      runtime.latestResult,
      store,
      runtime.analyticsSnapshot,
    ),
    reminders: runtime.reminders,
    pageContext: runtime.pageContext,
    pagePolicy: runtime.pagePolicy,
    provider: assistantTurn.provider,
  };
}
