import test from "node:test";
import assert from "node:assert/strict";

import {
  DPP_PLAN_RETENTION_LIMIT,
  pruneDppPlansForUser,
} from "../src/legacy/analytics-store";

test("DPP retention keeps a 30-plan window and deletes older plan roots", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return { rows: [{ deleted_count: 7 }] };
    },
  } as unknown as NonNullable<Parameters<typeof pruneDppPlansForUser>[2]>;

  const deletedCount = await pruneDppPlansForUser("user_1", DPP_PLAN_RETENTION_LIMIT, fakeClient);

  assert.equal(DPP_PLAN_RETENTION_LIMIT, 30);
  assert.equal(deletedCount, 7);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["user_1", 30]);
  assert.match(calls[0].sql, /ROW_NUMBER\(\) OVER \(ORDER BY created_at DESC, sequence ASC, id DESC\)/);
  assert.match(calls[0].sql, /DELETE FROM analytics\.dpp_plans/);
  assert.match(calls[0].sql, /dpp_rank > \$2/);
});

test("DPP retention skips invalid limits without touching storage", async () => {
  let queryCount = 0;
  const fakeClient = {
    query: async () => {
      queryCount += 1;
      return { rows: [{ deleted_count: 1 }] };
    },
  } as unknown as NonNullable<Parameters<typeof pruneDppPlansForUser>[2]>;

  const deletedCount = await pruneDppPlansForUser("user_1", 0, fakeClient);

  assert.equal(deletedCount, 0);
  assert.equal(queryCount, 0);
});
