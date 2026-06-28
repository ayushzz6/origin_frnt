import { unstable_cache } from "next/cache";
import type { DifficultyLevel, QuestionType, StoredAnswerSpec, StoredQuestion } from "@/server/store";

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";

declare global {
  var __originOgcodeCatalogSchemaReady: Promise<void> | undefined;
}

type CatalogFilters = {
  subject?: string | null;
  /** Premium entitlement allow-list (Phase 1.4): restrict to these subjects. */
  subjects?: string[] | null;
  difficulty?: string | null;
  type?: string | null;
  search?: string | null;
  chapters?: string[] | null;
};

type CatalogPageFilters = CatalogFilters & {
  includeIds?: string[] | null;
  excludeIds?: string[] | null;
  limit: number;
  offset: number;
};

type CatalogRow = {
  id: string;
  source_index: number;
  text: string;
  options: string[] | null;
  correct_option: number | null;
  correct_options: number[] | null;
  answer_text: string | null;
  answer_spec: StoredAnswerSpec | null;
  tolerance: number | null;
  matrix_data: { column_a: string[]; column_b: string[]; correct_pairs: number[][] } | null;
  explanation: string;
  hint: string | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: string;
  image: string | null;
  tags: string[] | string | null;
  question_type: string;
  acceptance_rate: number | string | null;
  total_correct: number | string | null;
  frequency: number | string | null;
  is_challenge_of_day: boolean;
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_questions (
    id TEXT PRIMARY KEY,
    source_index INTEGER NOT NULL UNIQUE,
    text TEXT NOT NULL,
    options JSONB,
    correct_option INTEGER,
    correct_options JSONB,
    answer_text TEXT,
    answer_spec JSONB,
    tolerance DOUBLE PRECISION,
    matrix_data JSONB,
    explanation TEXT NOT NULL,
    hint TEXT,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    concept TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    image TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    question_type TEXT NOT NULL,
    acceptance_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    frequency INTEGER NOT NULL DEFAULT 0,
    is_challenge_of_day BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS ogcode_questions_subject_idx ON ogcode_questions (subject);
  CREATE INDEX IF NOT EXISTS ogcode_questions_difficulty_idx ON ogcode_questions (difficulty);
  CREATE INDEX IF NOT EXISTS ogcode_questions_question_type_idx ON ogcode_questions (question_type);
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS answer_spec JSONB;
`;

function normalizeDifficulty(value: string): DifficultyLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard" || normalized === "insane") {
    return normalized as DifficultyLevel;
  }
  return "medium";
}

function normalizeQuestionType(value: string): QuestionType {
  if (
    value === "mcq" ||
    value === "msq" ||
    value === "numerical" ||
    value === "matrix_match" ||
    value === "subjective"
  ) {
    return value;
  }
  return "subjective";
}

function normalizeSubject(value: string | null | undefined): string {
  const subject = String(value ?? "physics").trim().toLowerCase();
  if (subject === "maths") {
    return "mathematics";
  }
  return subject || "physics";
}

function toTextArray(value: unknown): string[] | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return null;
}

function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const numbers = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
  return numbers.length ? numbers : null;
}

function normalizeOptionText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-d]\s*[).:-]\s*/i, "")
    .replace(/\s+/g, " ");
}

/**
 * Reconciles correct_option against answer_text + options at read time so rows
 * imported by older importer versions (which mis-treated numeric answers as
 * 1-based indices) return the right option without a DB re-import.
 */
function reconcileCorrectOption(
  questionType: string,
  options: string[] | null,
  rawCorrectOption: number | null,
  answerText: string | null,
): number | null {
  if (!options || options.length === 0) {
    return rawCorrectOption;
  }
  if (questionType !== "mcq") {
    return rawCorrectOption;
  }

  const normalizedAnswer = normalizeOptionText(answerText);
  if (!normalizedAnswer) {
    return rawCorrectOption;
  }

  const textMatchIndex = options.findIndex((option) => normalizeOptionText(option) === normalizedAnswer);
  if (textMatchIndex < 0) {
    return rawCorrectOption;
  }

  // Prefer the unambiguous text match over a stored index that disagrees.
  return textMatchIndex;
}

function mapCatalogRow(row: CatalogRow): StoredQuestion {
  const options = toTextArray(row.options);
  const rawCorrectOption = row.correct_option == null ? null : Number(row.correct_option);
  const questionType = normalizeQuestionType(String(row.question_type));
  const reconciledCorrectOption = reconcileCorrectOption(
    questionType,
    options,
    rawCorrectOption,
    row.answer_text ?? null,
  );
  return {
    id: row.id,
    text: row.text,
    options,
    correctOption: reconciledCorrectOption,
    correctOptions: toNumberArray(row.correct_options),
    answerText: row.answer_text ?? null,
    answerSpec: row.answer_spec ?? null,
    tolerance: row.tolerance == null ? null : Number(row.tolerance),
    matrixData: row.matrix_data ?? null,
    explanation: row.explanation,
    hint: row.hint ?? null,
    subject: normalizeSubject(row.subject),
    chapter: row.chapter,
    concept: row.concept,
    difficulty: normalizeDifficulty(String(row.difficulty)),
    image: row.image ?? null,
    tags: Array.isArray(row.tags) ? row.tags.map((entry) => String(entry)) : row.tags ?? null,
    questionType,
    acceptanceRate: Number(row.acceptance_rate ?? 0),
    totalCorrect: Number(row.total_correct ?? 0),
    frequency: Number(row.frequency ?? 0),
    isChallengeOfTheDay: Boolean(row.is_challenge_of_day),
  };
}

async function ensureCatalogSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return;
  }

  if (!globalThis.__originOgcodeCatalogSchemaReady) {
    globalThis.__originOgcodeCatalogSchemaReady = pool.query(CREATE_TABLE_SQL).then(() => undefined).catch((error) => {
      globalThis.__originOgcodeCatalogSchemaReady = undefined;
      throw error;
    });
  }

  await globalThis.__originOgcodeCatalogSchemaReady;
}

function buildFilterClause(filters: CatalogFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.subject) {
    values.push(normalizeSubject(filters.subject));
    clauses.push(`subject = $${values.length}`);
  }

  const subjects = (filters.subjects ?? [])
    .map((entry) => normalizeSubject(String(entry ?? "")))
    .filter(Boolean);
  if (subjects.length) {
    values.push(subjects);
    clauses.push(`subject = ANY($${values.length}::text[])`);
  }

  if (filters.difficulty) {
    values.push(String(filters.difficulty).trim().toLowerCase());
    clauses.push(`difficulty = $${values.length}`);
  }

  if (filters.type) {
    values.push(String(filters.type).trim().toLowerCase());
    clauses.push(`question_type = $${values.length}`);
  }

  const chapters = (filters.chapters ?? [])
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
  if (chapters.length) {
    values.push(chapters);
    clauses.push(`chapter = ANY($${values.length}::text[])`);
  }

  const search = String(filters.search ?? "").trim();
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    clauses.push(
      `(LOWER(text) LIKE $${values.length} OR LOWER(chapter) LIKE $${values.length} OR LOWER(concept) LIKE $${values.length} OR LOWER(COALESCE(tags::text, '')) LIKE $${values.length})`,
    );
  }

  return {
    clauses,
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

export function isOgcodeCatalogAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

async function _listOgcodeCatalogQuestions(filters: CatalogFilters = {}): Promise<StoredQuestion[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return [];
  }

  await ensureCatalogSchema();
  const { sql, values } = buildFilterClause(filters);
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day
      FROM ogcode_questions
      ${sql}
      ORDER BY source_index ASC
    `,
    values,
  );

  return result.rows.map(mapCatalogRow);
}

// Cache the full catalog for 5 minutes — this is a large read-heavy query and
// the question bank changes infrequently. Revalidate via the "ogcode-catalog" tag
// when questions are added/updated.
export const listOgcodeCatalogQuestions = unstable_cache(
  _listOgcodeCatalogQuestions,
  ["ogcode-catalog-questions"],
  { revalidate: 300, tags: ["ogcode-catalog"] },
);

export async function listOgcodeCatalogQuestionIds(filters: CatalogFilters = {}): Promise<string[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return [];
  }

  await ensureCatalogSchema();
  const { sql, values } = buildFilterClause(filters);
  const result = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM ogcode_questions
      ${sql}
      ORDER BY source_index ASC
    `,
    values,
  );

  return result.rows.map((row) => row.id);
}

export async function listOgcodeCatalogQuestionPage(filters: CatalogPageFilters): Promise<{
  items: StoredQuestion[];
  total: number;
}> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { items: [], total: 0 };
  }

  await ensureCatalogSchema();
  const base = buildFilterClause(filters);
  const clauses = [...base.clauses];
  const values = [...base.values];
  const includeIds = [...new Set((filters.includeIds ?? []).filter(Boolean))];
  const excludeIds = [...new Set((filters.excludeIds ?? []).filter(Boolean))];

  if (includeIds.length) {
    values.push(includeIds);
    clauses.push(`id = ANY($${values.length}::text[])`);
  }

  if (excludeIds.length) {
    values.push(excludeIds);
    clauses.push(`NOT (id = ANY($${values.length}::text[]))`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  values.push(Math.max(1, Math.trunc(filters.limit)), Math.max(0, Math.trunc(filters.offset)));

  const result = await pool.query<(CatalogRow & { total_count: number | string })>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day,
        COUNT(*) OVER() AS total_count
      FROM ogcode_questions
      ${where}
      ORDER BY source_index ASC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  );

  return {
    items: result.rows.map(mapCatalogRow),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}

export async function listOgcodeCatalogChapters(subject: string): Promise<string[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return [];
  }

  await ensureCatalogSchema();
  const result = await pool.query<{ chapter: string }>(
    `
      SELECT DISTINCT chapter
      FROM ogcode_questions
      WHERE subject = $1
      ORDER BY chapter ASC
    `,
    [normalizeSubject(subject)],
  );

  return result.rows
    .map((row) => row.chapter.trim())
    .filter(Boolean);
}

export async function getOgcodeCatalogQuestionById(questionId: string): Promise<StoredQuestion | null> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return null;
  }

  await ensureCatalogSchema();
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day
      FROM ogcode_questions
      WHERE id = $1
      LIMIT 1
    `,
    [questionId],
  );

  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null;
}

export async function getOgcodeCatalogQuestionMap(questionIds: string[]): Promise<Map<string, StoredQuestion>> {
  const pool = getOgcodePostgresPool();
  if (!pool || !questionIds.length) {
    return new Map();
  }

  await ensureCatalogSchema();
  const uniqueIds = [...new Set(questionIds)];
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day
      FROM ogcode_questions
      WHERE id = ANY($1::text[])
    `,
    [uniqueIds],
  );

  return new Map<string, StoredQuestion>(
    result.rows.map((row: CatalogRow) => [row.id, mapCatalogRow(row)]),
  );
}

export async function getOgcodeCatalogCounts() {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { total: 0, bySubject: {} as Record<string, number> };
  }

  await ensureCatalogSchema();
  const result = await pool.query<{ subject: string; total: number | string }>(
    `
      SELECT subject, COUNT(*)::int AS total
      FROM ogcode_questions
      GROUP BY subject
    `,
  );

  const bySubject: Record<string, number> = {};
  let total = 0;
  result.rows.forEach((row: { subject: string; total: number | string }) => {
    const count = Number(row.total ?? 0);
    bySubject[normalizeSubject(row.subject)] = count;
    total += count;
  });

  return { total, bySubject };
}

export async function getOgcodeChallengeQuestion(): Promise<StoredQuestion | null> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return null;
  }

  await ensureCatalogSchema();

  // Pool 1: explicitly curated challenge questions. Pool 2: full MCQ catalog.
  // Whichever pool is non-empty, pick a stable-per-day row using today's
  // epoch-day as an offset so the challenge rotates automatically each day.
  const curatedCountResult = await pool.query<{ total: number | string }>(
    `SELECT COUNT(*)::int AS total FROM ogcode_questions WHERE is_challenge_of_day = true`,
  );
  const curatedCount = Number(curatedCountResult.rows[0]?.total ?? 0);

  const baseFilter = curatedCount > 0
    ? `WHERE is_challenge_of_day = true`
    : `WHERE question_type = 'mcq' AND correct_option IS NOT NULL`;

  const totalResult = await pool.query<{ total: number | string }>(
    `SELECT COUNT(*)::int AS total FROM ogcode_questions ${baseFilter}`,
  );
  const total = Number(totalResult.rows[0]?.total ?? 0);
  if (total <= 0) {
    return null;
  }

  const epochDay = Math.floor(Date.now() / 86_400_000);
  const offset = ((epochDay % total) + total) % total;

  const result = await pool.query<CatalogRow>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day
      FROM ogcode_questions
      ${baseFilter}
      ORDER BY source_index ASC, id ASC
      OFFSET $1
      LIMIT 1
    `,
    [offset],
  );

  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null;
}

export async function incrementOgcodeCatalogQuestionStats(questionId: string, isCorrect: boolean): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return;
  }

  await ensureCatalogSchema();
  await pool.query(
    `
      UPDATE ogcode_questions
      SET
        frequency = frequency + 1,
        total_correct = total_correct + CASE WHEN $2 THEN 1 ELSE 0 END,
        acceptance_rate = CASE
          WHEN frequency + 1 > 0 THEN
            ((total_correct + CASE WHEN $2 THEN 1 ELSE 0 END)::double precision / (frequency + 1)::double precision) * 100
          ELSE 0
        END
      WHERE id = $1
    `,
    [questionId, isCorrect],
  );
}
