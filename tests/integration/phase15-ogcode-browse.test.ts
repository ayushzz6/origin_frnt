/**
 * Phase 15 — teacher OG Code browse service.
 *
 * Verifies the teacher browse returns questions from the catalog (the FULL bank —
 * no premium gate) and that the list payload is answer-free.
 *
 * Runs only when USER_DATABASE_URL is configured. Pins the OGCODE pool to USER DSN.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_OGCODE = "1";
if (process.env.USER_DATABASE_URL) {
  process.env.OGCODE_DATABASE_URL = process.env.OGCODE_DATABASE_URL ?? process.env.USER_DATABASE_URL;
}

import { getOgcodeCatalogQuestionMap } from "@/server/ogcode-catalog";
import { listOgcodeBrowsePage } from "@/server/workspaces/ogcode-browse-service";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();
const it = test;

it("phase 15: teacher OG Code browse returns catalog questions, answer-free", { skip: SKIP }, async () => {
  const ogId = makeId("ogq_browse");
  try {
    await getOgcodeCatalogQuestionMap(["__ensure_schema__"]);
    await rawPool().query(
      `INSERT INTO ogcode_questions
         (id, source_index, text, explanation, subject, chapter, concept, difficulty, question_type, options, correct_option)
       VALUES ($1, $2, $3, 'because', 'physics', 'Optics', 'Lenses', 'medium', 'mcq',
               '["A","B"]'::jsonb, 1)
       ON CONFLICT (id) DO NOTHING`,
      [ogId, Math.floor(Math.random() * 1_000_000_000), `Browse sample ${ogId}`],
    );

    // Search by the unique stem so the assertion is deterministic regardless of
    // how many other questions exist in the bank / their ordering.
    const page = await listOgcodeBrowsePage({ search: ogId, limit: 50, offset: 0 });
    const item = page.items.find((i) => i.id === ogId);
    assert.ok(item, "browse returns the seeded ogcode question");
    assert.ok(page.total >= 1, "total reflects the matching set");
    // Answer fields must NOT be in the browse payload.
    const raw = item as unknown as Record<string, unknown>;
    assert.equal(raw.correctOption, undefined, "correctOption is stripped");
    assert.equal(raw.answerText, undefined, "answerText is stripped");
    assert.equal(raw.explanation, undefined, "explanation is stripped");
    // But the question + its options are present for vetting.
    assert.equal(item?.text, `Browse sample ${ogId}`);
    assert.deepEqual(item?.options, ["A", "B"]);
  } finally {
    await rawPool().query(`DELETE FROM ogcode_questions WHERE id = $1`, [ogId]);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
