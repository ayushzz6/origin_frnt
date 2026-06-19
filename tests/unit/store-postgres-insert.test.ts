import test from "node:test";
import assert from "node:assert/strict";

import { buildCollectionInsertChunks } from "../../src/server/store-postgres";

// Each collection row maps to 8 columns in this fixed order.
const row = (id: string): unknown[] => [id, "user_1", null, null, null, "{}", "t0", "t0"];

test("buildCollectionInsertChunks: no rows produces no statements", () => {
  assert.deepEqual(buildCollectionInsertChunks("streaks", []), []);
});

test("buildCollectionInsertChunks: single chunk numbers placeholders sequentially", () => {
  const [chunk, ...rest] = buildCollectionInsertChunks("point_logs", [row("a"), row("b")]);
  assert.equal(rest.length, 0, "two rows under the chunk size stay in one statement");
  // 2 rows * 8 columns = 16 bind params.
  assert.equal(chunk.values.length, 16);
  // First row: $1..$8 (data column cast to jsonb); second row: $9..$16.
  assert.ok(chunk.text.includes("($1,$2,$3,$4,$5,$6::jsonb,$7,$8)"));
  assert.ok(chunk.text.includes("($9,$10,$11,$12,$13,$14::jsonb,$15,$16)"));
  assert.ok(chunk.text.includes("INSERT INTO app.point_logs"));
  assert.ok(chunk.text.includes("ON CONFLICT (id) DO UPDATE SET"));
  // Values are flattened in row-then-column order.
  assert.equal(chunk.values[0], "a");
  assert.equal(chunk.values[8], "b");
});

test("buildCollectionInsertChunks: splits into chunks and restarts numbering per chunk", () => {
  const chunks = buildCollectionInsertChunks("practice_attempts", [row("a"), row("b"), row("c")], 2);
  assert.equal(chunks.length, 2);
  // First chunk: 2 rows -> 16 params; second chunk: 1 row -> 8 params.
  assert.equal(chunks[0].values.length, 16);
  assert.equal(chunks[1].values.length, 8);
  // Placeholder numbering is per-statement, so the second chunk restarts at $1.
  assert.ok(chunks[1].text.includes("($1,$2,$3,$4,$5,$6::jsonb,$7,$8)"));
  assert.ok(!chunks[1].text.includes("$9"));
  assert.equal(chunks[1].values[0], "c");
});

test("buildCollectionInsertChunks: a non-positive chunk size never yields empty/invalid statements", () => {
  const chunks = buildCollectionInsertChunks("streaks", [row("a"), row("b")], 0);
  assert.equal(chunks.length, 2);
  for (const chunk of chunks) {
    assert.equal(chunk.values.length, 8);
  }
});
