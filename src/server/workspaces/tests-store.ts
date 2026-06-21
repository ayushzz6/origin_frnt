/**
 * Assessment store: tests, test_questions, test_assignments, test_attempts, test_answers.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureAssessmentSchema } from "./assessment-schema";
import {
  createAssignmentId,
  createAttemptId,
  createTestId,
} from "./ids";
import type {
  AssessmentTest,
  AssignmentStatus,
  AttemptStatus,
  QuestionSourceBank,
  TestAnswer,
  TestAssignment,
  TestAssignmentWithCounts,
  TestAttempt,
  TestQuestion,
  TestSource,
  TestStatus,
  TestWithQuestions,
} from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToTest(row: Record<string, unknown>): AssessmentTest {
  return {
    id: row.id as string,
    ownerScope: row.owner_scope as "student" | "workspace" | "platform",
    workspaceId: (row.workspace_id as string | null) ?? null,
    createdBy: row.created_by as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    subject: row.subject as string,
    chapter: (row.chapter as string | null) ?? null,
    difficulty: row.difficulty as string,
    durationMinutes: Number(row.duration_minutes) || 0,
    totalQuestions: Number(row.total_questions) || 0,
    status: row.status as TestStatus,
    source: row.source as TestSource,
    selectionPolicy: (row.selection_policy as Record<string, unknown>) ?? {},
    scoringPolicy: (row.scoring_policy as Record<string, unknown>) ?? {},
    settings: (row.settings as Record<string, unknown>) ?? {},
    sourceImportJobId: (row.source_import_job_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToTestQuestion(row: Record<string, unknown>): TestQuestion {
  return {
    testId: row.test_id as string,
    position: Number(row.position) || 0,
    sourceBank: row.source_bank as QuestionSourceBank,
    ogcodeQuestionId: (row.ogcode_question_id as string | null) ?? null,
    contentQuestionId: (row.content_question_id as string | null) ?? null,
    contentQuestionVersionId: (row.content_question_version_id as string | null) ?? null,
    marks: Number(row.marks) || 4,
    negativeMarks: Number(row.negative_marks) || -1,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function rowToAssignment(row: Record<string, unknown>): TestAssignment {
  return {
    id: row.id as string,
    testId: row.test_id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    studentId: (row.student_id as string | null) ?? null,
    scheduledStartAt: row.scheduled_start_at ? new Date(row.scheduled_start_at as string).toISOString() : null,
    scheduledEndAt: row.scheduled_end_at ? new Date(row.scheduled_end_at as string).toISOString() : null,
    status: row.status as AssignmentStatus,
    assignedBy: (row.assigned_by as string | null) ?? null,
    assignedAt: new Date(row.assigned_at as string).toISOString(),
    settings: (row.settings as Record<string, unknown>) ?? {},
  };
}

function rowToAttempt(row: Record<string, unknown>): TestAttempt {
  return {
    id: row.id as string,
    testId: row.test_id as string,
    assignmentId: (row.assignment_id as string | null) ?? null,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    roomId: (row.room_id as string | null) ?? null,
    studentId: row.student_id as string,
    attemptNumber: Number(row.attempt_number) || 1,
    status: row.status as AttemptStatus,
    startedAt: new Date(row.started_at as string).toISOString(),
    serverDeadline: row.server_deadline ? new Date(row.server_deadline as string).toISOString() : null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at as string).toISOString() : null,
    score: row.score !== null ? Number(row.score) : null,
    totalMarks: Number(row.total_marks) || 0,
    percentage: row.percentage !== null ? Number(row.percentage) : null,
    timeTakenSeconds: row.time_taken_seconds !== null ? Number(row.time_taken_seconds) : null,
    gradingStatus: (row.grading_status as "pending" | "grading" | "completed" | "failed") ?? "pending",
    analyticsStatus: (row.analytics_status as "pending" | "processing" | "completed" | "failed") ?? "pending",
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

export type CreateTestInput = {
  workspaceId: string;
  createdBy: string;
  title: string;
  description?: string | null;
  subject?: string;
  chapter?: string | null;
  difficulty?: string;
  durationMinutes: number;
  totalQuestions: number;
  status?: TestStatus;
  source?: TestSource;
  selectionPolicy?: Record<string, unknown>;
  scoringPolicy?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  sourceImportJobId?: string | null;
};

export async function createTest(input: CreateTestInput): Promise<AssessmentTest> {
  await ensureAssessmentSchema();
  const id = createTestId();
  const result = await pool().query(
    `INSERT INTO assessment.tests (
       id, owner_scope, workspace_id, created_by, title, description,
       subject, chapter, difficulty, duration_minutes, total_questions,
       status, source, selection_policy, scoring_policy, settings, source_import_job_id
     ) VALUES ($1,'workspace',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.createdBy,
      input.title,
      input.description ?? null,
      input.subject ?? "mixed",
      input.chapter ?? null,
      input.difficulty ?? "medium",
      input.durationMinutes,
      input.totalQuestions,
      input.status ?? "draft",
      input.source ?? "manual",
      JSON.stringify(input.selectionPolicy ?? {}),
      JSON.stringify(input.scoringPolicy ?? {}),
      JSON.stringify(input.settings ?? {}),
      input.sourceImportJobId ?? null,
    ],
  );
  return rowToTest(result.rows[0]);
}

export async function getTestById(testId: string): Promise<AssessmentTest | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.tests WHERE id = $1`,
    [testId],
  );
  return result.rows[0] ? rowToTest(result.rows[0]) : null;
}

export async function getTestWithQuestions(testId: string): Promise<TestWithQuestions | null> {
  await ensureAssessmentSchema();
  const test = await getTestById(testId);
  if (!test) return null;
  const qRows = await pool().query(
    `SELECT * FROM assessment.test_questions
     WHERE test_id = $1
     ORDER BY position ASC`,
    [testId],
  );
  return {
    ...test,
    questions: qRows.rows.map(rowToTestQuestion),
  };
}

export async function listTests(
  workspaceId: string,
  filter?: { status?: TestStatus | "all" },
): Promise<AssessmentTest[]> {
  await ensureAssessmentSchema();
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND status = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM assessment.tests
     WHERE ${where}
     ORDER BY created_at DESC`,
    params,
  );
  return result.rows.map(rowToTest);
}

export async function updateTest(
  testId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    subject: string;
    chapter: string | null;
    difficulty: string;
    durationMinutes: number;
    totalQuestions: number;
    status: TestStatus;
    selectionPolicy: Record<string, unknown>;
    scoringPolicy: Record<string, unknown>;
    settings: Record<string, unknown>;
  }>,
): Promise<AssessmentTest | null> {
  await ensureAssessmentSchema();
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const map: Record<string, string> = {
    title: "title",
    description: "description",
    subject: "subject",
    chapter: "chapter",
    difficulty: "difficulty",
    durationMinutes: "duration_minutes",
    totalQuestions: "total_questions",
    status: "status",
    selectionPolicy: "selection_policy",
    scoringPolicy: "scoring_policy",
    settings: "settings",
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (["selectionPolicy", "scoringPolicy", "settings"].includes(key)) {
      fields.push(`${map[key]} = $${i++}::jsonb`);
      params.push(JSON.stringify(value));
    } else {
      fields.push(`${map[key]} = $${i++}`);
      params.push(value);
    }
  }
  if (fields.length === 0) return getTestById(testId);
  fields.push("updated_at = NOW()");
  params.push(testId);
  const result = await pool().query(
    `UPDATE assessment.tests
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToTest(result.rows[0]) : null;
}

// ─── Test Questions ────────────────────────────────────────────────────────

export async function addQuestionToTest(input: {
  testId: string;
  position: number;
  sourceBank: QuestionSourceBank;
  ogcodeQuestionId?: string | null;
  contentQuestionId?: string | null;
  contentQuestionVersionId?: string | null;
  marks?: number;
  negativeMarks?: number;
  metadata?: Record<string, unknown>;
}): Promise<TestQuestion> {
  await ensureAssessmentSchema();
  await pool().query(
    `INSERT INTO assessment.test_questions (
       test_id, position, source_bank, ogcode_question_id,
       content_question_id, content_question_version_id, marks, negative_marks, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (test_id, position) DO UPDATE
       SET source_bank = EXCLUDED.source_bank,
           ogcode_question_id = EXCLUDED.ogcode_question_id,
           content_question_id = EXCLUDED.content_question_id,
           content_question_version_id = EXCLUDED.content_question_version_id,
           marks = EXCLUDED.marks,
           negative_marks = EXCLUDED.negative_marks,
           metadata = EXCLUDED.metadata`,
    [
      input.testId,
      input.position,
      input.sourceBank,
      input.ogcodeQuestionId ?? null,
      input.contentQuestionId ?? null,
      input.contentQuestionVersionId ?? null,
      input.marks ?? 4,
      input.negativeMarks ?? -1,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const result = await pool().query(
    `SELECT * FROM assessment.test_questions WHERE test_id = $1 AND position = $2`,
    [input.testId, input.position],
  );
  return rowToTestQuestion(result.rows[0]);
}

export async function listTestQuestions(testId: string): Promise<TestQuestion[]> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.test_questions WHERE test_id = $1 ORDER BY position ASC`,
    [testId],
  );
  return result.rows.map(rowToTestQuestion);
}

// ─── Test Assignments ───────────────────────────────────────────────────────

export type CreateAssignmentInput = {
  testId: string;
  workspaceId?: string | null;
  batchId?: string | null;
  studentId?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  assignedBy: string;
};

/** Removes all question rows for a test (used when an editor replaces them). */
export async function clearTestQuestions(testId: string): Promise<void> {
  await ensureAssessmentSchema();
  await pool().query(`DELETE FROM assessment.test_questions WHERE test_id = $1`, [testId]);
}

/**
 * Deletes a test and (via ON DELETE CASCADE) its questions, assignments, attempts
 * and answers. Scoped to the workspace so a teacher can only delete their own tests.
 */
export async function deleteTest(workspaceId: string, testId: string): Promise<boolean> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `DELETE FROM assessment.tests WHERE id = $1 AND workspace_id = $2`,
    [testId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<TestAssignment> {
  await ensureAssessmentSchema();
  const id = createAssignmentId();
  const result = await pool().query(
    `INSERT INTO assessment.test_assignments (
       id, test_id, workspace_id, batch_id, student_id,
       scheduled_start_at, scheduled_end_at, assigned_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      id,
      input.testId,
      input.workspaceId ?? null,
      input.batchId ?? null,
      input.studentId ?? null,
      input.scheduledStartAt ?? null,
      input.scheduledEndAt ?? null,
      input.assignedBy,
    ],
  );
  return rowToAssignment(result.rows[0]);
}

export async function listTestAssignments(
  testId: string,
): Promise<TestAssignmentWithCounts[]> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT a.*, b.name AS batch_name,
            COALESCE(COUNT(DISTINCT bm.student_id) FILTER (WHERE bm.status = 'active'), 0)::int AS student_count
     FROM assessment.test_assignments a
     LEFT JOIN app.batches b ON b.id = a.batch_id
     LEFT JOIN app.batch_members bm ON bm.batch_id = a.batch_id
     WHERE a.test_id = $1
     GROUP BY a.id, b.name
     ORDER BY a.assigned_at DESC`,
    [testId],
  );
  return result.rows.map((row) => ({
    ...rowToAssignment(row),
    batchName: (row.batch_name as string | null) ?? null,
    studentCount: Number(row.student_count) || 0,
  }));
}

export async function getStudentAssignment(
  studentId: string,
  testId: string,
): Promise<TestAssignment | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.test_assignments
     WHERE test_id = $1 AND student_id = $2
     ORDER BY assigned_at DESC
     LIMIT 1`,
    [testId, studentId],
  );
  return result.rows[0] ? rowToAssignment(result.rows[0]) : null;
}

// ─── Phase 14: teacher tests → student visibility ─────────────────────────────

/** A teacher-assigned test surfaced to an enrolled student, with cohort context. */
export type AssignedTestForStudent = {
  test: AssessmentTest;
  assignmentId: string;
  workspaceId: string | null;
  batchId: string | null;
  windowEndsAt: string | null;
  /**
   * Ordered question ids backing the test, in position order: the ogcode id for
   * `ogcode` rows and the content-question id for `workspace_bag` rows. The legacy
   * taker resolves each via the store → ogcode → content lookup chain.
   */
  orderedQuestionIds: string[];
};

/**
 * Ordered question reference ids for a test across ALL source banks (ogcode +
 * workspace_bag), in position order. ogcode rows contribute their
 * `ogcode_question_id`; workspace_bag rows contribute their `content_question_id`.
 */
async function loadOrderedTestQuestionRefIds(testId: string): Promise<string[]> {
  const res = await pool().query(
    `SELECT source_bank, ogcode_question_id, content_question_id
       FROM assessment.test_questions
      WHERE test_id = $1
      ORDER BY position ASC`,
    [testId],
  );
  return res.rows
    .map((r) =>
      (r.source_bank as string) === "ogcode"
        ? ((r.ogcode_question_id as string | null) ?? null)
        : ((r.content_question_id as string | null) ?? null),
    )
    .filter((id): id is string => Boolean(id));
}

const ASSIGNED_TEST_WHERE = `
  t.status IN ('published', 'live')
  AND a.status IN ('assigned', 'open')
  AND (bm.student_id IS NOT NULL OR a.student_id = $1)
`;

/**
 * Teacher tests visible to a student: published/live tests with an open assignment
 * the student can reach, either via active batch membership OR a direct student
 * assignment. This membership join IS the server-side gate — never trust the list.
 */
export async function listAssignedTestPreviewsForStudent(studentId: string): Promise<
  Array<{
    id: string;
    title: string;
    description: string | null;
    subject: string;
    chapter: string | null;
    difficulty: string;
    durationMinutes: number;
    totalQuestions: number;
    workspaceId: string | null;
    batchId: string | null;
    assignmentId: string;
    windowEndsAt: string | null;
  }>
> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT DISTINCT ON (t.id)
            t.id, t.title, t.description, t.subject, t.chapter, t.difficulty,
            t.duration_minutes, t.total_questions, t.workspace_id,
            a.id AS assignment_id, a.batch_id, a.scheduled_end_at
       FROM assessment.test_assignments a
       INNER JOIN assessment.tests t ON t.id = a.test_id
       LEFT JOIN app.batch_members bm
         ON bm.batch_id = a.batch_id AND bm.status = 'active' AND bm.student_id = $1
      WHERE ${ASSIGNED_TEST_WHERE}
      ORDER BY t.id, a.scheduled_start_at DESC NULLS LAST`,
    [studentId],
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    subject: row.subject as string,
    chapter: (row.chapter as string | null) ?? null,
    difficulty: row.difficulty as string,
    durationMinutes: Number(row.duration_minutes) || 0,
    totalQuestions: Number(row.total_questions) || 0,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    assignmentId: row.assignment_id as string,
    windowEndsAt: row.scheduled_end_at ? new Date(row.scheduled_end_at as string).toISOString() : null,
  }));
}

/**
 * Resolves a single teacher-assigned test for a student WITH the same membership
 * gate as the list — returns null when the test is not assigned/reachable. Callers
 * use null + the test's existence to decide between 403 (exists, not a member) and
 * 404 (unknown id). Includes the ordered ogcode question ids backing the test.
 */
export async function getAssignedTestForStudent(
  studentId: string,
  testId: string,
): Promise<AssignedTestForStudent | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT DISTINCT ON (t.id) t.*, a.id AS assignment_id, a.batch_id AS assignment_batch_id,
            a.scheduled_end_at
       FROM assessment.test_assignments a
       INNER JOIN assessment.tests t ON t.id = a.test_id
       LEFT JOIN app.batch_members bm
         ON bm.batch_id = a.batch_id AND bm.status = 'active' AND bm.student_id = $1
      WHERE t.id = $2 AND ${ASSIGNED_TEST_WHERE}
      ORDER BY t.id, a.scheduled_start_at DESC NULLS LAST`,
    [studentId, testId],
  );
  const row = result.rows[0];
  if (!row) return null;

  const orderedQuestionIds = await loadOrderedTestQuestionRefIds(testId);
  return {
    test: rowToTest(row),
    assignmentId: row.assignment_id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.assignment_batch_id as string | null) ?? null,
    windowEndsAt: row.scheduled_end_at ? new Date(row.scheduled_end_at as string).toISOString() : null,
    orderedQuestionIds,
  };
}

/**
 * Phase 14 (rooms): resolve a teacher test (assessment.tests) for use inside a
 * study room. Unlike {@link getAssignedTestForStudent} there is NO assignment /
 * batch-membership gate here — room participation is the entitlement, enforced by
 * the caller (the room engine re-checks membership). Returns the test plus its
 * ordered ogcode-bank question ids, or null if the test does not exist. Shaped as
 * an AssignedTestForStudent so the legacy taker can reuse `assignedTeacherTestToRecord`.
 */
export async function getTeacherTestForRoom(testId: string): Promise<AssignedTestForStudent | null> {
  await ensureAssessmentSchema();
  const testResult = await pool().query(`SELECT * FROM assessment.tests WHERE id = $1`, [testId]);
  const row = testResult.rows[0];
  if (!row) return null;

  const orderedQuestionIds = await loadOrderedTestQuestionRefIds(testId);
  return {
    test: rowToTest(row),
    assignmentId: "",
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: null,
    windowEndsAt: null,
    orderedQuestionIds,
  };
}

// ─── Test Attempts ──────────────────────────────────────────────────────────

export async function startAttempt(input: {
  testId: string;
  assignmentId?: string | null;
  workspaceId?: string | null;
  batchId?: string | null;
  roomId?: string | null;
  studentId: string;
  attemptNumber: number;
  serverDeadline?: string | null;
}): Promise<TestAttempt> {
  await ensureAssessmentSchema();
  const id = createAttemptId();
  const result = await pool().query(
    `INSERT INTO assessment.test_attempts (
       id, test_id, assignment_id, workspace_id, batch_id, room_id,
       student_id, attempt_number, server_deadline
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      id,
      input.testId,
      input.assignmentId ?? null,
      input.workspaceId ?? null,
      input.batchId ?? null,
      input.roomId ?? null,
      input.studentId,
      input.attemptNumber,
      input.serverDeadline ?? null,
    ],
  );
  return rowToAttempt(result.rows[0]);
}

export async function submitAttempt(input: {
  attemptId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  timeTakenSeconds: number;
  answers: TestAnswer[];
}): Promise<TestAttempt> {
  await ensureAssessmentSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE assessment.test_attempts
       SET status = 'submitted', submitted_at = NOW(),
           score = $2, total_marks = $3, percentage = $4,
           time_taken_seconds = $5
       WHERE id = $1`,
      [input.attemptId, input.score, input.totalMarks, input.percentage, input.timeTakenSeconds],
    );
    for (const answer of input.answers) {
      await client.query(
        `INSERT INTO assessment.test_answers (
           attempt_id, position, question_snapshot, submitted_answer,
           grading_result, time_spent_seconds, is_marked_for_review
         ) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7)
         ON CONFLICT (attempt_id, position) DO UPDATE
           SET submitted_answer = EXCLUDED.submitted_answer,
               grading_result = EXCLUDED.grading_result,
               time_spent_seconds = EXCLUDED.time_spent_seconds,
               is_marked_for_review = EXCLUDED.is_marked_for_review`,
        [
          input.attemptId,
          answer.position,
          JSON.stringify(answer.questionSnapshot),
          JSON.stringify(answer.submittedAnswer),
          JSON.stringify(answer.gradingResult),
          answer.timeSpentSeconds,
          answer.isMarkedForReview,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  const result = await pool().query(
    `SELECT * FROM assessment.test_attempts WHERE id = $1`,
    [input.attemptId],
  );
  return rowToAttempt(result.rows[0]);
}

export async function getActiveAttempt(
  studentId: string,
  testId: string,
): Promise<TestAttempt | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.test_attempts
     WHERE student_id = $1 AND test_id = $2 AND status = 'in_progress'
     LIMIT 1`,
    [studentId, testId],
  );
  return result.rows[0] ? rowToAttempt(result.rows[0]) : null;
}

export async function listAttemptResults(
  testId: string,
  filter?: { batchId?: string },
): Promise<TestAttempt[]> {
  await ensureAssessmentSchema();
  const params: unknown[] = [testId];
  let extra = "";
  if (filter?.batchId) {
    params.push(filter.batchId);
    extra = ` AND batch_id = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM assessment.test_attempts
     WHERE test_id = $1 AND status = 'submitted'${extra}
     ORDER BY score DESC, time_taken_seconds ASC`,
    params,
  );
  return result.rows.map(rowToAttempt);
}

export async function getTestLeaderboard(
  testId: string,
  limit = 20,
): Promise<Array<TestAttempt & { rank: number }>> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, time_taken_seconds ASC) AS rank
     FROM assessment.test_attempts
     WHERE test_id = $1 AND status = 'submitted'
     ORDER BY score DESC, time_taken_seconds ASC
     LIMIT $2`,
    [testId, limit],
  );
  return result.rows.map((row) => ({
    ...rowToAttempt(row),
    rank: Number(row.rank) || 0,
  }));
}