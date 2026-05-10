import fs from "node:fs";
import path from "node:path";

import pg from "pg";

const { Client } = pg;

const DEFAULT_BANK_DIR = path.resolve(process.cwd(), "data/ogcode");
const DEFAULT_BANKS = [
  { subject: "physics", code: "phy", file: "extracted_phy_questions.json" },
  { subject: "chemistry", code: "chem", file: "extracted_chem_questions.json" },
  { subject: "mathematics", code: "math", file: "extracted_math_questions.json" },
  { subject: "biology", code: "bio", file: "extracted_bio_questions.json" },
];

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

function normalizeSubject(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "phy" || normalized === "physics") {
    return "physics";
  }
  if (normalized === "chem" || normalized === "chemistry") {
    return "chemistry";
  }
  if (normalized === "math" || normalized === "maths" || normalized === "mathematics") {
    return "mathematics";
  }
  if (normalized === "bio" || normalized === "biology") {
    return "biology";
  }
  return null;
}

function subjectCodeFromSubject(subject) {
  if (subject === "physics") {
    return "phy";
  }
  if (subject === "chemistry") {
    return "chem";
  }
  if (subject === "mathematics") {
    return "math";
  }
  if (subject === "biology") {
    return "bio";
  }
  return "gen";
}

function deriveSubjectFromFilePath(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("phy") || name.includes("physics")) {
    return "physics";
  }
  if (name.includes("chem") || name.includes("chemistry")) {
    return "chemistry";
  }
  if (name.includes("math")) {
    return "mathematics";
  }
  if (name.includes("bio") || name.includes("biology")) {
    return "biology";
  }
  return null;
}

function parseSubjectFileArg(value) {
  const trimmed = String(value ?? "").trim();
  const separator = trimmed.includes("=") ? "=" : trimmed.includes(":") ? ":" : null;
  if (!separator) {
    throw new Error(`Invalid --subject-file value "${trimmed}". Use subject=path.`);
  }

  const [rawSubject, rawPath] = trimmed.split(separator);
  const subject = normalizeSubject(rawSubject);
  if (!subject) {
    throw new Error(`Unsupported subject "${rawSubject}" in --subject-file argument.`);
  }
  if (!rawPath) {
    throw new Error(`Missing file path in --subject-file value "${trimmed}".`);
  }

  return { subject, code: subjectCodeFromSubject(subject), file: path.resolve(rawPath.trim()) };
}

function parseArgs(argv) {
  const args = { dryRun: false, replace: false, banks: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (value === "--replace") {
      args.replace = true;
      continue;
    }
    if (value === "--subject-file") {
      const subjectFileArg = argv[index + 1];
      if (!subjectFileArg) {
        throw new Error("Missing value for --subject-file.");
      }
      args.banks.push(parseSubjectFileArg(subjectFileArg));
      index += 1;
      continue;
    }
    if (value === "--file") {
      const fileArg = argv[index + 1];
      if (!fileArg) {
        throw new Error("Missing value for --file.");
      }
      const file = path.resolve(fileArg);
      const subject = deriveSubjectFromFilePath(file);
      if (!subject) {
        throw new Error(`Could not derive subject from file "${file}". Use --subject-file subject=path.`);
      }
      args.banks.push({ subject, code: subjectCodeFromSubject(subject), file });
      index += 1;
      continue;
    }
  }

  if (!args.banks.length) {
    args.banks = DEFAULT_BANKS.map((entry) => ({
      subject: entry.subject,
      code: entry.code,
      file: path.join(DEFAULT_BANK_DIR, entry.file),
    }));
  }

  return args;
}

function extractFirstNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  return match ? Number(match[0]) : null;
}

function isNumericalAnswer(answer) {
  return /^[-+]?\d*\.?\d+(?:e[-+]?\d+)?(?:\s*[a-zA-Z%°/^\-]+)?$/.test(
    String(answer ?? "").trim().replace(/,/g, ""),
  );
}

function deriveTolerance(answer) {
  const raw = String(answer ?? "").trim();
  const numeric = extractFirstNumber(raw);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const decimalMatch = raw.match(/\.(\d+)/);
  const decimalTolerance = decimalMatch ? 10 ** -decimalMatch[1].length : 0.01;
  const percentTolerance = Math.abs(numeric) * 0.01;
  return Number(Math.max(decimalTolerance, percentTolerance, 0.001).toFixed(6));
}

function normalizeDifficulty(value) {
  const difficulty = String(value ?? "medium").trim().toLowerCase();
  if (["easy", "medium", "hard", "insane"].includes(difficulty)) {
    return difficulty;
  }
  return "medium";
}

function deriveSymbolAssumptions(answer) {
  const symbols = [...new Set((String(answer ?? "").match(/\b[a-z]\b/g) ?? []).map((entry) => entry.trim()))];
  if (!symbols.length) {
    return null;
  }
  return Object.fromEntries(symbols.map((symbol) => [symbol, "positive"]));
}

function deriveAnswerSpec(answer, questionType, tolerance) {
  const value = String(answer ?? "").trim();
  if (!value) {
    return null;
  }

  if (questionType === "numerical") {
    const unitMatch = value.match(/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*([a-zA-Z%°/^\-]+)$/);
    if (unitMatch?.[1]) {
      return {
        gradingMode: "numerical_with_units",
        expectedValue: value,
        acceptedUnits: [unitMatch[1]],
        tolerance,
        metadata: { source: "ogcode-importer" },
      };
    }

    return {
      gradingMode: "numerical",
      expectedValue: value,
      tolerance,
      metadata: { source: "ogcode-importer" },
    };
  }

  const targetMatch = value.match(/^\s*([a-zA-Z]+)\s*=/);
  const formulaLike = /[=\\/^*+\-]|√|sqrt|sin|cos|tan|log|ln/.test(value);
  if (formulaLike) {
    return {
      gradingMode: targetMatch ? "equation" : "symbolic_expression",
      expectedValue: value,
      acceptedForms: [value],
      targetVariable: targetMatch ? targetMatch[1] : null,
      allowRhsOnly: Boolean(targetMatch),
      tolerance,
      symbolAssumptions: deriveSymbolAssumptions(value),
      metadata: { source: "ogcode-importer" },
    };
  }

  return {
    gradingMode: "subjective_text",
    expectedValue: value,
    metadata: { source: "ogcode-importer" },
  };
}

function normalizeOptionText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-d]\s*[).:-]\s*/i, "")
    .replace(/\s+/g, " ");
}

function findCorrectOptionIndex(options, answer) {
  if (!options?.length) {
    return null;
  }

  // Try exact / normalized text match first. Answers in this dataset are values
  // (e.g. "3"), not 1-based option indices, so matching by text is the reliable
  // path and avoids the common failure where a numeric value collides with an
  // index (answer "3" with options ["3","2","4","5"] must resolve to index 0,
  // not index 2).
  const normalizedAnswer = normalizeOptionText(answer);
  if (normalizedAnswer) {
    const matchedIndex = options.findIndex((option) => normalizeOptionText(option) === normalizedAnswer);
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  // Fallback: genuine 1-based option index (e.g. answer is "2" meaning option B)
  // but only when no option text matches.
  const answerNumber = Number(String(answer ?? "").trim());
  if (Number.isInteger(answerNumber) && answerNumber >= 1 && answerNumber <= options.length) {
    return answerNumber - 1;
  }

  return null;
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) {
    return null;
  }
  const normalized = rawOptions.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  return normalized.length ? normalized : null;
}

function buildSeedRowsForSubject(rawQuestions, subject, subjectCode) {
  const hardQuestionIndex = rawQuestions.findIndex(
    (question) => normalizeDifficulty(question.Difficulty_Level) === "hard",
  );

  return rawQuestions.map((question, index) => {
    const answer = String(question.Answer ?? "").trim();
    const options = normalizeOptions(question.MCQ_Options);
    const inferredQuestionType = options?.length ? "mcq" : isNumericalAnswer(answer) ? "numerical" : "subjective";
    const tolerance = inferredQuestionType === "numerical" ? deriveTolerance(answer) : null;
    const correctOption = inferredQuestionType === "mcq" ? findCorrectOptionIndex(options, answer) : null;

    return {
      id: `ogcode_${subjectCode}_${String(index + 1).padStart(4, "0")}`,
      source_index: 0,
      text: String(question.Question ?? "").trim(),
      options,
      correct_option: correctOption,
      correct_options: null,
      answer_text: answer || null,
      answer_spec: inferredQuestionType === "mcq" ? null : deriveAnswerSpec(answer, inferredQuestionType, tolerance),
      tolerance,
      matrix_data: null,
      explanation: String(question.Detailed_Explanation ?? "").trim() || "Explanation unavailable.",
      hint: String(question.Hint ?? "").trim() || null,
      subject,
      chapter: String(question.Chapter ?? "General").trim() || "General",
      concept: String(question.Concept ?? "General Practice").trim() || "General Practice",
      difficulty: normalizeDifficulty(question.Difficulty_Level),
      image: null,
      tags: [
        subject,
        String(question.Chapter ?? "").trim(),
        String(question.Concept ?? "").trim(),
        normalizeDifficulty(question.Difficulty_Level),
      ].filter(Boolean),
      question_type: inferredQuestionType,
      acceptance_rate: 0,
      total_correct: 0,
      frequency: 0,
      _isSubjectChallengeCandidate: index === hardQuestionIndex,
    };
  });
}

function getConnectionString() {
  return (
    process.env.OGCODE_DATABASE_URL ??
    process.env.OGCODE_POSTGRES_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

function getSslConfig(connectionString) {
  try {
    const url = new URL(connectionString);
    return ["localhost", "127.0.0.1"].includes(url.hostname) ? false : { rejectUnauthorized: false };
  } catch {
    return connectionString.includes("localhost") ? false : { rejectUnauthorized: false };
  }
}

function loadQuestions(filePath) {
  const rawFile = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(rawFile);
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

function summarizeRows(rows, banks) {
  const summary = rows.reduce(
    (accumulator, row) => {
      accumulator.byDifficulty[row.difficulty] = (accumulator.byDifficulty[row.difficulty] ?? 0) + 1;
      accumulator.byType[row.question_type] = (accumulator.byType[row.question_type] ?? 0) + 1;
      accumulator.bySubject[row.subject] = (accumulator.bySubject[row.subject] ?? 0) + 1;
      if (row.question_type === "mcq") {
        accumulator.mcq.total += 1;
        const key = row.correct_option == null ? "null" : String(row.correct_option);
        accumulator.mcq.correctOptionDistribution[key] = (accumulator.mcq.correctOptionDistribution[key] ?? 0) + 1;
        if (row.correct_option != null) {
          accumulator.mcq.withCorrectOption += 1;
        }
      }
      return accumulator;
    },
    {
      bySubject: {},
      byDifficulty: {},
      byType: {},
      mcq: {
        total: 0,
        withCorrectOption: 0,
        correctOptionDistribution: {},
        firstTwoOptionShare: 0,
      },
    },
  );

  const firstTwoCount =
    (summary.mcq.correctOptionDistribution["0"] ?? 0) +
    (summary.mcq.correctOptionDistribution["1"] ?? 0);
  summary.mcq.firstTwoOptionShare = summary.mcq.withCorrectOption
    ? Number(((firstTwoCount / summary.mcq.withCorrectOption) * 100).toFixed(1))
    : 0;

  return {
    files: banks.map((entry) => ({ subject: entry.subject, file: entry.file })),
    totals: summary,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const rows = [];
  for (const bank of args.banks) {
    const rawQuestions = loadQuestions(bank.file);
    if (!rawQuestions.length) {
      throw new Error(`No questions found in ${bank.file}`);
    }
    rows.push(...buildSeedRowsForSubject(rawQuestions, bank.subject, bank.code));
  }

  if (!rows.length) {
    throw new Error("No OGCode questions prepared.");
  }

  rows.forEach((row, index) => {
    row.source_index = index + 1;
    row.is_challenge_of_day = false;
  });

  const firstChallenge = rows.find((row) => row._isSubjectChallengeCandidate);
  if (firstChallenge) {
    firstChallenge.is_challenge_of_day = true;
  }

  const summary = summarizeRows(rows, args.banks);
  console.log(`Prepared ${rows.length} OGCode questions from ${args.banks.length} source files`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.totals.mcq.firstTwoOptionShare >= 70) {
    console.warn(
      `Warning: ${summary.totals.mcq.firstTwoOptionShare}% of MCQs with a correct option resolve to A/B. Runtime option shuffling is required.`,
    );
  }

  if (args.dryRun) {
    return;
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("Set OGCODE_DATABASE_URL, OGCODE_POSTGRES_URL, POSTGRES_URL, or DATABASE_URL before importing OGCode questions.");
  }

  const client = new Client({
    connectionString,
    ssl: getSslConfig(connectionString),
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(CREATE_TABLE_SQL);
    if (args.replace) {
      await client.query("DELETE FROM ogcode_questions");
    }

    const batchSize = 250;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      await client.query(
        `
          INSERT INTO ogcode_questions (
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
            updated_at
          )
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
            NOW()
          FROM jsonb_to_recordset($1::jsonb) AS row(
            id TEXT,
            source_index INTEGER,
            text TEXT,
            options JSONB,
            correct_option INTEGER,
            correct_options JSONB,
            answer_text TEXT,
            answer_spec JSONB,
            tolerance DOUBLE PRECISION,
            matrix_data JSONB,
            explanation TEXT,
            hint TEXT,
            subject TEXT,
            chapter TEXT,
            concept TEXT,
            difficulty TEXT,
            image TEXT,
            tags JSONB,
            question_type TEXT,
            acceptance_rate DOUBLE PRECISION,
            total_correct INTEGER,
            frequency INTEGER,
            is_challenge_of_day BOOLEAN
          )
          ON CONFLICT (id) DO UPDATE SET
            source_index = EXCLUDED.source_index,
            text = EXCLUDED.text,
            options = EXCLUDED.options,
            correct_option = EXCLUDED.correct_option,
            correct_options = EXCLUDED.correct_options,
            answer_text = EXCLUDED.answer_text,
            answer_spec = EXCLUDED.answer_spec,
            tolerance = EXCLUDED.tolerance,
            matrix_data = EXCLUDED.matrix_data,
            explanation = EXCLUDED.explanation,
            hint = EXCLUDED.hint,
            subject = EXCLUDED.subject,
            chapter = EXCLUDED.chapter,
            concept = EXCLUDED.concept,
            difficulty = EXCLUDED.difficulty,
            image = EXCLUDED.image,
            tags = EXCLUDED.tags,
            question_type = EXCLUDED.question_type,
            is_challenge_of_day = EXCLUDED.is_challenge_of_day,
            updated_at = NOW()
        `,
        [JSON.stringify(batch)],
      );
    }

    await client.query("COMMIT");
    console.log(`Imported ${rows.length} OGCode questions into ogcode_questions.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
