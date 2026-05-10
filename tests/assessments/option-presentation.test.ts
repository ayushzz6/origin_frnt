import test from "node:test";
import assert from "node:assert/strict";

import {
  createOptionPresentationToken,
  getOptionDisplayOrder,
  presentOptions,
  verifyOptionPresentationToken,
} from "../../src/server/option-presentation";
import { serializeTest, serializeTestPreview, submitPracticeQuestion, submitTest } from "../../src/server/assessments";
import { withStoredUserDefaults, type AppStore, type StoredQuestion, type StoredUser } from "../../src/server/store";

const SECRET = "12345678901234567890123456789012";
process.env.OPTION_SHUFFLE_SECRET = SECRET;

const CONTEXT = {
  userId: "user_1",
  scope: "test" as const,
  assessmentId: "test_1",
  questionId: "question_1",
  attemptKey: "1",
  optionCount: 4,
};

test("option presentation tokens verify and produce stable display order", () => {
  const token = createOptionPresentationToken(CONTEXT, SECRET);
  const payload = verifyOptionPresentationToken(token, CONTEXT, SECRET);

  assert.ok(payload);
  assert.deepEqual(getOptionDisplayOrder(payload, SECRET), getOptionDisplayOrder(payload, SECRET));
});

test("option presentation rejects tampering and wrong question context", () => {
  const token = createOptionPresentationToken(CONTEXT, SECRET);

  assert.equal(verifyOptionPresentationToken(`${token.slice(0, -1)}x`, CONTEXT, SECRET), null);
  assert.equal(
    verifyOptionPresentationToken(
      token,
      { ...CONTEXT, questionId: "question_2" },
      SECRET,
    ),
    null,
  );
});

test("presentOptions returns shuffled options without exposing the order in the token", () => {
  const options = ["A", "B", "C", "D"];
  const first = presentOptions(options, {
    userId: CONTEXT.userId,
    scope: CONTEXT.scope,
    assessmentId: CONTEXT.assessmentId,
    questionId: CONTEXT.questionId,
    attemptKey: CONTEXT.attemptKey,
  });
  const second = presentOptions(options, {
    userId: CONTEXT.userId,
    scope: CONTEXT.scope,
    assessmentId: CONTEXT.assessmentId,
    questionId: CONTEXT.questionId,
    attemptKey: CONTEXT.attemptKey,
  });

  assert.deepEqual(first.options, second.options);
  assert.equal(first.presentationId, second.presentationId);
  assert.notDeepEqual(first.options, options);
  assert.equal(first.presentationId?.includes("0,1,2,3"), false);
});

function buildPracticeStore() {
  const user: StoredUser = withStoredUserDefaults({
    id: CONTEXT.userId,
    name: "Test User",
    email: "test@example.com",
    password: "",
    role: "student",
    studentClass: null,
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 0,
    totalStudyTime: 0,
    joinedAt: new Date(0).toISOString(),
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: true,
    selectedCourse: null,
    isDropper: false,
    yearsOfExperience: null,
    subjects: [],
    studentCapacity: null,
  });
  const question: StoredQuestion = {
    id: CONTEXT.questionId,
    text: "Which option is correct?",
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    correctOption: 0,
    correctOptions: null,
    answerText: null,
    tolerance: null,
    matrixData: null,
    explanation: "Alpha is correct.",
    hint: null,
    subject: "physics",
    chapter: "mechanics",
    concept: "bias-check",
    difficulty: "easy",
    image: null,
    tags: [],
    questionType: "mcq",
    acceptanceRate: 0,
    totalCorrect: 0,
    frequency: 0,
    isChallengeOfTheDay: false,
  };
  const store: AppStore = {
    users: [user],
    streaks: [],
    dailyActivities: [],
    dailySubjectActivities: [],
    pomodoroSessions: [],
    userScores: [],
    pointLogs: [],
    questions: [question],
    tests: [],
    testResults: [],
    practiceAttempts: [],
    dpps: [],
    assignments: [],
    subjectRanks: [],
    books: [],
    notes: [],
    bookmarks: [],
    savedBooks: [],
    doubtSessions: [],
    originAiProfiles: [],
    originAiSessions: [],
    originAiReminders: [],
    authSessions: [],
    leaderboardSeed: [],
    tasks: [],
    otps: [],
  };
  return { store, user, question };
}

test("answered practice MCQs require a presentation token and grade displayed indexes", async () => {
  const { store, user, question } = buildPracticeStore();
  await assert.rejects(
    () =>
      submitPracticeQuestion(store, user, question.id, {
        selected_option: 0,
        time_spent: 12,
      }),
    /Option presentation token is required/,
  );

  const token = createOptionPresentationToken({
    userId: user.id,
    scope: "practice",
    assessmentId: "practice-bank",
    questionId: question.id,
    attemptKey: "unit",
    optionCount: question.options?.length ?? 0,
  });
  const payload = verifyOptionPresentationToken(token, {
    userId: user.id,
    questionId: question.id,
    optionCount: question.options?.length ?? 0,
  });
  assert.ok(payload);

  const displayedCorrectOption = getOptionDisplayOrder(payload).indexOf(question.correctOption ?? -1);
  assert.notEqual(displayedCorrectOption, -1);

  const result = await submitPracticeQuestion(store, user, question.id, {
    presentation_id: token,
    selected_option: displayedCorrectOption,
    time_spent: 12,
  });
  const resultInfo = result as typeof result & { correctOption?: number };

  assert.equal(result.isCorrect, true);
  assert.equal(resultInfo.correctOption, displayedCorrectOption);
});

test("test previews and details use the same resolved question count", () => {
  const { store, user, question } = buildPracticeStore();
  const testId = "test_count_mismatch";
  store.tests.push({
    id: testId,
    title: "Count mismatch test",
    description: "Contains a stale missing question reference.",
    subject: "physics",
    chapter: "mechanics",
    difficulty: "easy",
    duration: 10,
    totalQuestions: 2,
    isPremium: false,
    questionIds: [question.id, "missing_question"],
    createdBy: null,
  });

  const preview = serializeTestPreview(store, user.id, store.tests[0]);
  const detail = serializeTest(store, user.id, store.tests[0]);

  assert.equal(preview.totalQuestions, 1);
  assert.equal(detail.totalQuestions, 1);
  assert.deepEqual((preview as typeof preview & { missingQuestionIds: string[] }).missingQuestionIds, ["missing_question"]);
  assert.deepEqual((detail as typeof detail & { missingQuestionIds: string[] }).missingQuestionIds, ["missing_question"]);
});

test("seeded tests without a chapter submit without dereferencing persisted metadata", async () => {
  const { store, user, question } = buildPracticeStore();
  const testId = "seed_without_chapter";
  store.tests.push({
    id: testId,
    title: "Seeded mixed test",
    description: "Seeded assessments can omit chapter metadata.",
    subject: "mathematics",
    chapter: null,
    difficulty: "medium",
    duration: 10,
    totalQuestions: 1,
    isPremium: false,
    questionIds: [question.id],
    createdBy: null,
  });

  const result = await submitTest(store, user, testId, {
    answers: [],
    timeTaken: 0,
    isMalpractice: false,
  });

  assert.equal(result.testId, testId);
  assert.equal(result.unattempted, 1);
});
