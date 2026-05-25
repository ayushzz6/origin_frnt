// Legacy store implementation kept behind the public server/store barrel.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Mutex } from "async-mutex";

import {
  dppQuestions,
  mockBooks,
  mockBookmarks,
  mockDoubtSessions,
  mockLeaderboard,
  mockLibraryUserSet,
  mockNotes,
  mockQuestions,
  mockTestResult,
  mockTests,
} from "@/data/mockData";
import { ncertBooksData } from "@/data/ncertBooks";
import type { Question } from "@/types";
import { hydrateStoreFromPostgres, persistStoreToPostgres } from "@/server/store-postgres";

export type UserRole = "student" | "teacher" | "admin";
export type QuestionType = "mcq" | "msq" | "numerical" | "matrix_match" | "subjective";
export type DifficultyLevel = "easy" | "medium" | "hard" | "insane";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  studentClass: string | null;
  fieldOfInterest: string | null;
  referralSource: string | null;
  avatar: string | null;
  streak: number;
  totalStudyTime: number;
  joinedAt: string;
  isPremium: boolean;
  premiumExpiry: string | null;
  isOnboarded: boolean;
  selectedCourse: string | null;
  isDropper: boolean;
  yearsOfExperience: string | null;
  subjects: string[];
  studentCapacity: string | null;
  location: string | null;
  voiceMinutesUsedToday: number;
  tokensUsedToday: number;
  usageResetAt: string;
  authTokenVersion: number;
}

export interface StoredStreakData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  weeklyData: boolean[];
}

export interface StoredDailyActivity {
  userId: string;
  date: string;
  questionsPracticed: number;
  webpageTime: number;
  practiceTime: number;
  pomodoroTime: number;
}

export interface StoredDailySubjectActivity {
  userId: string;
  date: string;
  subject: string;
  timeSpent: number;
}

export interface StoredPomodoroSession {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  mode: "focus" | "shortBreak" | "longBreak";
  breakReason: string | null;
  interruptionCount: number;
  isCompleted: boolean;
}

export interface StoredUserScore {
  userId: string;
  totalPoints: number;
  currentTier: string;
  lastUpdated: string;
}

export interface StoredPointLog {
  id: string;
  userId: string;
  points: number;
  activityType: string;
  description: string;
  timestamp: string;
  referenceId: string | null;
}

export interface StoredMatrixData {
  column_a: string[];
  column_b: string[];
  correct_pairs: number[][];
}

export interface StoredAnswerSpec {
  gradingMode: "mcq" | "msq" | "matrix_match" | "numerical" | "numerical_with_units" | "symbolic_expression" | "equation" | "subjective_text";
  expectedValue?: string | null;
  acceptedForms?: string[] | null;
  targetVariable?: string | null;
  allowRhsOnly?: boolean;
  acceptedUnits?: string[] | null;
  tolerance?: number | null;
  symbolAssumptions?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
}

export interface StoredQuestion {
  id: string;
  text: string;
  options: string[] | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  tolerance: number | null;
  matrixData: StoredMatrixData | null;
  explanation: string;
  hint: string | null;
  answerSpec?: StoredAnswerSpec | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: DifficultyLevel;
  image: string | null;
  tags: string[] | string | null;
  questionType: QuestionType;
  acceptanceRate: number;
  totalCorrect: number;
  frequency: number;
  isChallengeOfTheDay: boolean;
}

export interface StoredTest {
  id: string;
  title: string;
  description: string;
  subject: string;
  chapter: string | null;
  difficulty: DifficultyLevel;
  duration: number;
  totalQuestions: number;
  isPremium: boolean;
  questionIds: string[];
  createdBy: string | null;
}

export interface StoredUserAnswer {
  questionId: string;
  selectedOption: number | null;
  selectedOptions: number[] | null;
  matrixPairs: number[][] | null;
  answerText: string | null;
  timeSpent: number;
  isMarkedForReview: boolean;
  presentationId?: string | null;
}

export interface StoredTestResult {
  id: string;
  userId: string;
  testId: string;
  score: number;
  percentage: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTaken: number;
  weakAreas: Array<{ topic: string; accuracy: number }>;
  strongAreas: Array<{ topic: string; accuracy: number }>;
  aiAnalysis: {
    summary: string;
    mistakes: Array<{
      questionId: string;
      concept: string;
      error: string;
      explanation: string;
      howToApproach: string;
    }>;
    reviewEntries?: Array<{
      questionId: string;
      concept: string;
      status: "correct" | "incorrect";
      error: string;
      explanation: string;
      howToApproach: string;
    }>;
    recommendations: string[];
    dppGenerated: boolean;
    degraded?: boolean;
    degradedReason?: string | null;
    degraded_reason?: string | null;
  };
  subjectStats: Record<
    string,
    {
      score: number;
      total_marks: number;
      correct: number;
      incorrect: number;
      unattempted: number;
      total_qs: number;
      accuracy: number;
      time_spent_correct: number;
      time_spent_incorrect: number;
      time_spent_unattempted: number;
      total_time_spent: number;
    }
  >;
  isMalpractice: boolean;
  degraded?: boolean;
  degradedReason?: string | null;
  createdAt: string;
  answers: StoredUserAnswer[];
}

export interface StoredPracticeAttempt {
  id: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  selectedOptions: number[] | null;
  matrixPairs: number[][] | null;
  answerSubmitted: string | null;
  createdAt: string;
}

export interface StoredDpp {
  id: string;
  userId: string;
  title: string;
  subject: string;
  questionIds: string[];
  generatedFrom: string[];
  completed: boolean;
  createdAt: string;
}

export interface StoredAssignment {
  id: string;
  userId: string;
  title: string;
  subject: string;
  questionIds: string[];
  completed: boolean;
  dueDate: string | null;
  createdAt: string;
}

export interface StoredSubjectRank {
  userId: string;
  subject: string;
  questionsSolved: number;
  rankScore: number;
  latitude: number | null;
  longitude: number | null;
  locationShared: boolean;
  updatedAt: string;
}

export interface StoredBookChapter {
  id: string;
  title: string;
  pages: number;
  pdfFile: string | null;
}

export interface StoredBook {
  id: string;
  title: string;
  bookClass: string;
  subject: string;
  coverImage: string;
  basePath: string | null;
  chapters: StoredBookChapter[];
}

export interface StoredNote {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string | null;
  pageNumber: number | null;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface StoredBookmark {
  id: string;
  userId: string;
  bookId: string;
  pageNumber: number;
  title: string;
  createdAt: string;
}

export interface StoredSavedBook {
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
}

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  image: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface StoredDoubtSession {
  id: string;
  userId: string;
  title: string;
  subject: string;
  activeConcept: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

export interface StoredOriginAiReminder {
  id: string;
  userId: string;
  kind: "dpp" | "revision" | "assignment" | "habit";
  title: string;
  message: string;
  priority: "high" | "medium" | "low";
  sourceId: string | null;
  createdAt: string;
}

export interface StoredOriginAiProfileMemory {
  userId: string;
  preferredName: string | null;
  identitySummary: string | null;
  pinnedFacts: string[];
  lastWeakTopics: string[];
  lastTestResultId: string | null;
  lastVisitedPath: string | null;
  reminderDigest: string[];
  updatedAt: string;
}

export interface StoredOriginAiSession {
  id: string;
  userId: string;
  browserSessionId: string;
  title: string;
  summary: string | null;
  lastPathname: string | null;
  lastPageKind: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
  // Named-thread support: threadId is null for the default "floating avatar" session,
  // a UUID for each named full-window Doubt Solver thread. subject scopes KB lookups.
  threadId: string | null;
  subject: string | null;
  activeConcept: string | null;
}

export interface StoredAuthSession {
  id: string;
  accessToken: string;
  accessFingerprint?: string;
  refreshToken: string;
  refreshTokenHash?: string;
  userId: string;
  createdAt: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  userAgentHash?: string | null;
  ipPrefixHash?: string | null;
}

export interface StoredOtp {
  email: string;
  otp: string;
  expiresAt: string;
  verified?: boolean;
}

export interface StoredTask {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  due: string;
  createdAt: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface LeaderboardSeedEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  score: number;
  studyTime: number;
  location?: string;
  isLive: boolean;
}

export interface AppStore {
  users: StoredUser[];
  streaks: StoredStreakData[];
  dailyActivities: StoredDailyActivity[];
  dailySubjectActivities: StoredDailySubjectActivity[];
  pomodoroSessions: StoredPomodoroSession[];
  userScores: StoredUserScore[];
  pointLogs: StoredPointLog[];
  questions: StoredQuestion[];
  tests: StoredTest[];
  testResults: StoredTestResult[];
  practiceAttempts: StoredPracticeAttempt[];
  dpps: StoredDpp[];
  assignments: StoredAssignment[];
  subjectRanks: StoredSubjectRank[];
  books: StoredBook[];
  notes: StoredNote[];
  bookmarks: StoredBookmark[];
  savedBooks: StoredSavedBook[];
  doubtSessions: StoredDoubtSession[];
  originAiProfiles: StoredOriginAiProfileMemory[];
  originAiSessions: StoredOriginAiSession[];
  originAiReminders: StoredOriginAiReminder[];
  authSessions: StoredAuthSession[];
  leaderboardSeed: LeaderboardSeedEntry[];
  tasks: StoredTask[];
  otps: StoredOtp[];
}

type SeedUserConfig = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  studentClass?: string | null;
  fieldOfInterest?: string | null;
  referralSource?: string | null;
  avatar?: string | null;
  streak?: number;
  totalStudyTime?: number;
  joinedAt?: string;
  isPremium?: boolean;
  premiumExpiry?: string | null;
  isOnboarded?: boolean;
  selectedCourse?: string | null;
  isDropper?: boolean;
  yearsOfExperience?: string | null;
  subjects?: string[];
  studentCapacity?: string | null;
  location?: string | null;
};

type SeedQuestion = Question & {
  correctOptions?: number[];
  tolerance?: number;
  acceptance_rate?: number;
  acceptanceRate?: number;
  totalCorrect?: number;
  frequency?: number;
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

type StoredUserDefaultFields = Pick<
  StoredUser,
  "location" | "voiceMinutesUsedToday" | "tokensUsedToday" | "usageResetAt" | "authTokenVersion"
>;

export type StoredUserWithOptionalDefaults = Omit<StoredUser, keyof StoredUserDefaultFields> &
  Partial<StoredUserDefaultFields>;

export function withStoredUserDefaults(user: StoredUserWithOptionalDefaults): StoredUser {
  return {
    ...user,
    location: user.location ?? null,
    voiceMinutesUsedToday: user.voiceMinutesUsedToday ?? 0,
    tokensUsedToday: user.tokensUsedToday ?? 0,
    usageResetAt: user.usageResetAt ?? nowIso(),
    authTokenVersion: user.authTokenVersion ?? 0,
  };
}

function toStoredQuestion(question: SeedQuestion): StoredQuestion {
  return {
    id: String(question.id),
    text: question.text,
    options: question.options ?? null,
    correctOption: question.correctOption ?? null,
    correctOptions: question.correctOptions ?? null,
    answerText: question.answerText ?? null,
    tolerance: typeof question.tolerance === "number" ? question.tolerance : null,
    matrixData: question.matrixData ?? null,
    explanation: question.explanation ?? "Explanation unavailable.",
    hint: question.hint ?? null,
    subject: normalizeSubject(question.subject),
    chapter: question.chapter,
    concept: question.concept,
    difficulty: normalizeDifficulty(question.difficulty),
    image: question.image ?? null,
    tags: question.tags ?? null,
    questionType: normalizeQuestionType(question.questionType),
    acceptanceRate: Number(question.acceptance_rate ?? question.acceptanceRate ?? 0),
    totalCorrect: Number(question.totalCorrect ?? 0),
    frequency: Number(question.frequency ?? 0),
    isChallengeOfTheDay: false,
  };
}

function normalizeDifficulty(value: string | undefined): DifficultyLevel {
  if (value === "easy" || value === "medium" || value === "hard" || value === "insane") {
    return value;
  }
  return "medium";
}

function normalizeQuestionType(value: string | undefined): QuestionType {
  if (
    value === "mcq" ||
    value === "msq" ||
    value === "numerical" ||
    value === "matrix_match" ||
    value === "subjective"
  ) {
    return value;
  }
  return "mcq";
}

function normalizeSubject(subject: string | undefined): string {
  if (!subject) {
    return "physics";
  }
  const lower = subject.toLowerCase();
  if (lower === "maths") {
    return "mathematics";
  }
  return lower;
}

function createSeedUser(config: SeedUserConfig): StoredUser {
  return withStoredUserDefaults({
    id: config.id,
    name: config.name,
    email: config.email,
    password: config.password,
    role: config.role,
    studentClass: config.studentClass ?? null,
    fieldOfInterest: config.fieldOfInterest ?? null,
    referralSource: config.referralSource ?? "codex",
    avatar: config.avatar ?? null,
    streak: config.streak ?? 0,
    totalStudyTime: config.totalStudyTime ?? 0,
    joinedAt: config.joinedAt ?? nowIso(),
    isPremium: config.isPremium ?? false,
    premiumExpiry: config.premiumExpiry ?? null,
    isOnboarded: config.isOnboarded ?? true,
    selectedCourse: config.selectedCourse ?? null,
    isDropper: config.isDropper ?? false,
    yearsOfExperience: config.yearsOfExperience ?? null,
    subjects: config.subjects ?? [],
    studentCapacity: config.studentCapacity ?? null,
    location: config.location ?? null,
  });
}

// Plaintext passwords for seed users — used only to (re-)hash on store init.
// Never stored or transmitted in plaintext.
const SEED_PASSWORDS: Record<string, string> = {
  user_student_demo: "password123",
  user_teacher_demo: "password123",
  user_student_ayush: "Ap@1234",
  user_teacher_ayush: "Ap@1234",
  user_student_tohin: "123456",
  user_teacher_tohin: "123456",
  user_admin_legacy: "admin@origin",
};

function hashSeedPassword(id: string): string {
  const plain = SEED_PASSWORDS[id];
  if (!plain) throw new Error(`No seed password defined for user id: ${id}`);
  return bcrypt.hashSync(plain, 10);
}

function buildSeedUsers(joinedAt: string): StoredUser[] {
  return [
    createSeedUser({
      id: "user_student_demo",
      name: "Demo Learner",
      email: "student@origin.test",
      password: hashSeedPassword("user_student_demo"),
      role: "student",
      studentClass: "11",
      fieldOfInterest: "Engineering",
      streak: 5,
      totalStudyTime: 420,
      joinedAt,
      isOnboarded: true,
      selectedCourse: "JEE Main + Advanced",
      subjects: ["Physics", "Chemistry", "Mathematics"],
    }),
    createSeedUser({
      id: "user_teacher_demo",
      name: "Demo Teacher",
      email: "teacher@origin.test",
      password: hashSeedPassword("user_teacher_demo"),
      role: "teacher",
      streak: 3,
      totalStudyTime: 120,
      joinedAt,
      isPremium: true,
      isOnboarded: true,
      yearsOfExperience: "5+",
      subjects: ["Physics"],
      studentCapacity: "50",
    }),
    createSeedUser({
      id: "user_student_ayush",
      name: "Ayush Student",
      email: "ayushzz0306@gmail.com",
      password: hashSeedPassword("user_student_ayush"),
      role: "student",
      studentClass: "12",
      fieldOfInterest: "Engineering",
      joinedAt,
      selectedCourse: "JEE Main + Advanced",
      subjects: ["Physics", "Chemistry", "Mathematics"],
    }),
    createSeedUser({
      id: "user_teacher_ayush",
      name: "Ayush Teacher",
      email: "ayushzz0306@gmail.com",
      password: hashSeedPassword("user_teacher_ayush"),
      role: "teacher",
      joinedAt,
      yearsOfExperience: "3+",
      subjects: ["Physics", "Chemistry"],
      studentCapacity: "100",
    }),
    createSeedUser({
      id: "user_student_tohin",
      name: "Tohin Student",
      email: "tohin1400@gmail.com",
      password: hashSeedPassword("user_student_tohin"),
      role: "student",
      studentClass: "12",
      fieldOfInterest: "Engineering",
      joinedAt,
      selectedCourse: "JEE Main + Advanced",
      subjects: ["Physics", "Chemistry", "Mathematics"],
    }),
    createSeedUser({
      id: "user_teacher_tohin",
      name: "Tohin Teacher",
      email: "tohin1400@gmail.com",
      password: hashSeedPassword("user_teacher_tohin"),
      role: "teacher",
      joinedAt,
      yearsOfExperience: "4+",
      subjects: ["Mathematics"],
      studentCapacity: "75",
    }),
    createSeedUser({
      id: "user_admin_legacy",
      name: "Admin Console",
      email: "admin@origin.com",
      password: hashSeedPassword("user_admin_legacy"),
      role: "admin",
      joinedAt,
    }),
  ];
}

// Audit fix R-1.3 (A-06): the demo accounts (`user_student_demo`,
// `user_teacher_demo`, `user_admin_legacy`, etc.) ship with publicly
// known passwords. They are useful in development and CI for manual
// QA but must never be persisted to a production database. The
// companion migration `20260525_remove_demo_seeds.sql` deletes any
// rows that landed there before this guard existed.
function isDemoSeedingEnabled(): boolean {
  if (process.env.ORIGIN_ALLOW_DEMO_SEEDS === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function ensureSeedUsers(store: AppStore): boolean {
  if (!isDemoSeedingEnabled()) return false;

  let changed = false;
  const joinedAt = nowIso();
  // Previously this called buildSeedUsers(joinedAt) inside the loop, which
  // runs bcrypt.hashSync(cost=10) 6 times per call. With the outer loop also
  // at 6 iterations, that was 36 bcrypt rounds (~2.4s) on every readStore().
  const seedUsers = buildSeedUsers(joinedAt);

  for (const [id, plainPassword] of Object.entries(SEED_PASSWORDS)) {
    const seedUser = seedUsers.find((u) => u.id === id);
    if (!seedUser) continue;

    const existing = store.users.find(
      (entry) => entry.email.toLowerCase() === seedUser.email.toLowerCase() && entry.role === seedUser.role,
    );

    if (!existing) {
      store.users.push(seedUser);
      changed = true;
      continue;
    }

    // Re-hash if: stored password is plaintext (no bcrypt prefix) or doesn't match known plain password
    const storedIsHashed = existing.password.startsWith("$2");
    const passwordStillValid = storedIsHashed && bcrypt.compareSync(plainPassword, existing.password);
    if (!passwordStillValid) {
      existing.password = bcrypt.hashSync(plainPassword, 10);
      changed = true;
    }
  }

  return changed;
}

function buildSeedStore(): AppStore {
  const userId = "user_student_demo";
  const teacherId = "user_teacher_demo";
  const joinedAt = nowIso();

  const users = buildSeedUsers(joinedAt);

  const streaks: StoredStreakData[] = [
    {
      userId,
      currentStreak: 5,
      longestStreak: 12,
      lastStudyDate: new Date().toISOString().slice(0, 10),
      weeklyData: [true, true, true, true, true, false, false],
    },
    {
      userId: teacherId,
      currentStreak: 3,
      longestStreak: 7,
      lastStudyDate: new Date().toISOString().slice(0, 10),
      weeklyData: [false, true, false, true, true, false, true],
    },
  ];

  const questionsMap = new Map<string, StoredQuestion>();
  [...mockQuestions, ...dppQuestions].forEach((question) => {
    questionsMap.set(String(question.id), toStoredQuestion(question));
  });

  const challengeQuestion = questionsMap.get("10");
  if (challengeQuestion) {
    challengeQuestion.isChallengeOfTheDay = true;
  }

  const tests: StoredTest[] = mockTests.map((test) => ({
    id: String(test.id),
    title: test.title,
    description: test.description,
    subject: normalizeSubject(test.subject),
    chapter: test.chapter ?? null,
    difficulty: normalizeDifficulty(test.difficulty),
    duration: test.duration,
    totalQuestions: test.totalQuestions,
    isPremium: Boolean(test.isPremium),
    questionIds: test.questions.map((question) => String(question.id)),
    createdBy: null,
  }));

  const testResults: StoredTestResult[] = [
    {
      id: "result_seed_1",
      userId,
      testId: String(mockTestResult.testId),
      score: mockTestResult.score,
      percentage: mockTestResult.percentage ?? 75,
      correctAnswers: mockTestResult.correctAnswers,
      wrongAnswers: mockTestResult.wrongAnswers,
      unattempted: mockTestResult.unattempted,
      timeTaken: mockTestResult.timeTaken,
      weakAreas: jsonClone(mockTestResult.weakAreas),
      strongAreas: jsonClone(mockTestResult.strongAreas),
      aiAnalysis: jsonClone(mockTestResult.aiAnalysis),
      subjectStats: jsonClone(mockTestResult.subjectStats ?? {}),
      isMalpractice: Boolean(mockTestResult.isMalpractice),
      createdAt: nowIso(),
      answers: mockTestResult.answers.map((answer) => ({
        questionId: String(answer.questionId),
        selectedOption: answer.selectedOption ?? null,
        selectedOptions: answer.selectedOptions ?? null,
        matrixPairs: answer.matrixPairs ?? null,
        answerText: answer.answerText ?? null,
        timeSpent: answer.timeSpent,
        isMarkedForReview: answer.isMarkedForReview,
      })),
    },
  ];

  const practiceAttempts: StoredPracticeAttempt[] = [
    {
      id: "practice_seed_1",
      userId,
      questionId: "1",
      isCorrect: true,
      timeSpent: 90,
      selectedOptions: null,
      matrixPairs: null,
      answerSubmitted: "0",
      createdAt: nowIso(),
    },
    {
      id: "practice_seed_2",
      userId,
      questionId: "3",
      isCorrect: true,
      timeSpent: 70,
      selectedOptions: null,
      matrixPairs: null,
      answerSubmitted: "1",
      createdAt: nowIso(),
    },
  ];

  const booksMap = new Map<string, StoredBook>();
  mockBooks.forEach((book) => {
    booksMap.set(book.id, {
      id: book.id,
      title: book.title,
      bookClass: book.bookClass,
      subject: book.subject,
      coverImage: book.coverImage,
      basePath: book.basePath ?? null,
      chapters: (book.chapters ?? []).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        pages: chapter.pages,
        pdfFile: chapter.pdfFile ?? null,
      })),
    });
  });
  ncertBooksData.forEach((book) => {
    if (!booksMap.has(book.id)) {
      booksMap.set(book.id, {
        id: book.id,
        title: book.title,
        bookClass: book.bookClass,
        subject: book.subject,
        coverImage: "",
        basePath: book.basePath ?? null,
        chapters: (book.chapters ?? []).map((chapter, index) => ({
          id: chapter.id,
          title: chapter.title,
          pages: index + 1,
          pdfFile: chapter.pdfFile ?? null,
        })),
      });
    }
  });

  const notes: StoredNote[] = mockNotes.map((note) => ({
    id: String(note.id),
    userId,
    bookId: note.bookId,
    chapterId: note.chapterId ?? null,
    pageNumber: note.pageNumber ?? null,
    content: note.content,
    color: note.color,
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
    tags: note.tags,
  }));

  const bookmarks: StoredBookmark[] = mockBookmarks.map((bookmark) => ({
    id: String(bookmark.id),
    userId,
    bookId: bookmark.bookId,
    pageNumber: bookmark.pageNumber,
    title: bookmark.title,
    createdAt: new Date(bookmark.createdAt).toISOString(),
  }));

  const savedBooks: StoredSavedBook[] = mockLibraryUserSet.map((bookId, index) => ({
    id: `saved_book_${index + 1}`,
    userId,
    bookId,
    createdAt: nowIso(),
  }));

  const doubtSessions: StoredDoubtSession[] = mockDoubtSessions.map((session) => ({
    id: String(session.id),
    userId,
    title: session.title,
    subject: session.subject ?? "Physics",
    activeConcept: session.activeConcept ?? "Circular Motion",
    createdAt: new Date(session.createdAt).toISOString(),
    updatedAt: new Date(session.updatedAt).toISOString(),
    messages: session.messages.map((message) => ({
      id: String(message.id),
      role: message.role,
      content: message.content,
      image: message.image ?? null,
      metadata: jsonClone(message.metadata ?? {}),
      timestamp: new Date(message.timestamp).toISOString(),
    })),
  }));

  const pointLogs: StoredPointLog[] = [
    {
      id: "point_log_seed_1",
      userId,
      points: 55,
      activityType: "practice",
      description: "Solved hard Physics question",
      timestamp: nowIso(),
      referenceId: "10",
    },
    {
      id: "point_log_seed_2",
      userId,
      points: 20,
      activityType: "pomodoro",
      description: "Completed focus session",
      timestamp: nowIso(),
      referenceId: "pomodoro_seed_1",
    },
  ];

  const userScores: StoredUserScore[] = [
    {
      userId,
      totalPoints: 1280,
      currentTier: "Expert",
      lastUpdated: nowIso(),
    },
    {
      userId: teacherId,
      totalPoints: 600,
      currentTier: "Advanced",
      lastUpdated: nowIso(),
    },
  ];

  const dailyActivities: StoredDailyActivity[] = [
    {
      userId,
      date: new Date().toISOString().slice(0, 10),
      questionsPracticed: 6,
      webpageTime: 2100,
      practiceTime: 1200,
      pomodoroTime: 1500,
    },
  ];

  const dailySubjectActivities: StoredDailySubjectActivity[] = [
    {
      userId,
      date: new Date().toISOString().slice(0, 10),
      subject: "Physics",
      timeSpent: 1800,
    },
  ];

  const pomodoroSessions: StoredPomodoroSession[] = [
    {
      id: "pomodoro_seed_1",
      userId,
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString(),
      duration: 25 * 60,
      mode: "focus",
      breakReason: null,
      interruptionCount: 0,
      isCompleted: true,
    },
  ];

  const subjectRanks: StoredSubjectRank[] = [
    {
      userId,
      subject: "Physics",
      questionsSolved: 3,
      rankScore: 85,
      latitude: null,
      longitude: null,
      locationShared: false,
      updatedAt: nowIso(),
    },
    {
      userId,
      subject: "Chemistry",
      questionsSolved: 1,
      rankScore: 25,
      latitude: null,
      longitude: null,
      locationShared: false,
      updatedAt: nowIso(),
    },
  ];

  const dpps: StoredDpp[] = [
    {
      id: "dpp_seed_1",
      userId,
      title: "Redox Recovery Set",
      subject: "chemistry",
      questionIds: dppQuestions.map((question) => String(question.id)),
      generatedFrom: ["Redox Reactions", "Equilibrium"],
      completed: false,
      createdAt: nowIso(),
    },
  ];

  const leaderboardSeed = mockLeaderboard.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    name: entry.name,
    avatar: entry.avatar,
    score: entry.score,
    studyTime: entry.studyTime,
    location: entry.location,
    isLive: entry.isLive,
  }));

  return {
    users,
    streaks,
    dailyActivities,
    dailySubjectActivities,
    pomodoroSessions,
    userScores,
    pointLogs,
    questions: [...questionsMap.values()],
    tests,
    testResults,
    practiceAttempts,
    dpps,
    assignments: [],
    subjectRanks,
    books: [...booksMap.values()],
    notes,
    bookmarks,
    savedBooks,
    doubtSessions,
    originAiProfiles: [],
    originAiSessions: [],
    originAiReminders: [],
    authSessions: [],
    leaderboardSeed,
    tasks: [],
    otps: [],
  };
}

function ensureOriginAiCollections(store: AppStore): boolean {
  let changed = false;
  if (!Array.isArray((store as Partial<AppStore>).originAiProfiles)) {
    store.originAiProfiles = [];
    changed = true;
  }
  if (!Array.isArray((store as Partial<AppStore>).originAiSessions)) {
    store.originAiSessions = [];
    changed = true;
  } else {
    store.originAiSessions = store.originAiSessions.map((session, index) => {
      const base = session as Partial<StoredOriginAiSession> & StoredOriginAiSession;
      let next = session;

      if (typeof base.browserSessionId !== 'string' || !base.browserSessionId.trim()) {
        changed = true;
        next = { ...next, browserSessionId: `legacy-origin-ai-session-${next.userId}-${index}` };
      }
      if (!('threadId' in base)) {
        changed = true;
        next = { ...next, threadId: null };
      }
      if (!('subject' in base)) {
        changed = true;
        next = { ...next, subject: null };
      }
      if (!('activeConcept' in base)) {
        changed = true;
        next = { ...next, activeConcept: null };
      }

      return next;
    });
  }
  if (!Array.isArray((store as Partial<AppStore>).originAiReminders)) {
    store.originAiReminders = [];
    changed = true;
  }
  return changed;
}

function ensureAllCollections(store: AppStore): boolean {
  let changed = false;
  const collections: (keyof AppStore)[] = [
    "users",
    "streaks",
    "dailyActivities",
    "dailySubjectActivities",
    "pomodoroSessions",
    "userScores",
    "pointLogs",
    "questions",
    "tests",
    "testResults",
    "practiceAttempts",
    "dpps",
    "assignments",
    "subjectRanks",
    "books",
    "notes",
    "bookmarks",
    "savedBooks",
    "doubtSessions",
    "originAiProfiles",
    "originAiSessions",
    "originAiReminders",
    "authSessions",
    "leaderboardSeed",
    "tasks",
    "otps",
  ];

  for (const key of collections) {
    if (!Array.isArray((store as any)[key])) {
      (store as any)[key] = [];
      changed = true;
    }
  }

  for (const user of store.users) {
    const maybeUser = user as unknown as Record<string, unknown>;
    if (maybeUser.location === undefined) {
      user.location = null;
      changed = true;
    }
    if (typeof maybeUser.voiceMinutesUsedToday !== "number") {
      user.voiceMinutesUsedToday = 0;
      changed = true;
    }
    if (typeof maybeUser.tokensUsedToday !== "number") {
      user.tokensUsedToday = 0;
      changed = true;
    }
    if (typeof maybeUser.usageResetAt !== "string") {
      user.usageResetAt = nowIso();
      changed = true;
    }
  }

  // Also call specific ones for migrations/extra checks
  changed = ensureOriginAiCollections(store) || changed;

  return changed;
}

let cachedStore: AppStore | null = null;
let cachedSeedStore: AppStore | null = null;
let lastHydratedAt = 0;
const CACHE_TTL_MS = 2000; // Cache for 2 seconds
let activeHydrationPromise: Promise<AppStore> | null = null;

function getSeedStore(): AppStore {
  if (!cachedSeedStore) {
    cachedSeedStore = buildSeedStore();
    ensureSeedUsers(cachedSeedStore);
    ensureAllCollections(cachedSeedStore);
  }
  return jsonClone(cachedSeedStore);
}

export function readStore(): AppStore {
  if (!cachedStore) {
    cachedStore = getSeedStore();
  }
  return cachedStore;
}

export async function readStoreAsync(forceFresh = false): Promise<AppStore> {
  const now = Date.now();
  if (cachedStore && !forceFresh && (now - lastHydratedAt < CACHE_TTL_MS)) {
    return cachedStore;
  }

  if (activeHydrationPromise && !forceFresh) {
    return activeHydrationPromise;
  }

  activeHydrationPromise = (async () => {
    try {
      const seed = getSeedStore();
      const store = await hydrateStoreFromPostgres(seed);
      cachedStore = store;
      lastHydratedAt = Date.now();
      return store;
    } finally {
      activeHydrationPromise = null;
    }
  })();

  return activeHydrationPromise;
}

const storeMutex = new Mutex();

export async function withStoreAsync<T>(mutate: (store: AppStore) => Promise<T> | T): Promise<T> {
  return storeMutex.runExclusive(async () => {
    const store = await readStoreAsync(true);
    const result = await mutate(store);
    await persistStoreToPostgres(store);
    cachedStore = store;
    lastHydratedAt = Date.now();
    return result;
  });
}

export function resetStore(): AppStore {
  const fresh = buildSeedStore();
  cachedStore = fresh;
  return fresh;
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function cloneStore<T>(value: T): T {
  return jsonClone(value);
}
