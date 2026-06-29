import test from "node:test";
import assert from "node:assert/strict";

import { resolveDppBagSelection } from "../../src/server/dpp-question-bank";
import { isFeatureEnabled } from "../../src/lib/feature-flags";
import { PUBLIC_API_PATHS, getApiRoutePolicy } from "../../src/server/route-policy";

// ── DPP question-bank preference + provenance (pure) ────────────────────────

test("DPP: empty bag falls back to OG Code with a null workspace (no tenant scope)", () => {
  const out = resolveDppBagSelection({
    bagIds: [],
    ogcodeQuestionIds: ["og1", "og2", "og3"],
    targetCount: 3,
    workspaceId: "ws_A",
  });
  assert.deepEqual(out.questionIds, ["og1", "og2", "og3"]);
  assert.equal(out.workspaceId, null, "OG-only DPPs must NOT be workspace-scoped");
  assert.match(out.provenanceNote, /OG Code/i);
});

test("DPP: a full bag match is all-bag, workspace-stamped, and noted as bag-sourced", () => {
  const out = resolveDppBagSelection({
    bagIds: ["b1", "b2", "b3"],
    ogcodeQuestionIds: ["og1", "og2"],
    targetCount: 3,
    workspaceId: "ws_A",
  });
  assert.deepEqual(out.questionIds, ["b1", "b2", "b3"]);
  assert.equal(out.workspaceId, "ws_A", "bag-sourced DPPs MUST carry the owning workspace");
  assert.match(out.provenanceNote, /Question Bag/i);
});

test("DPP: a partial bag is topped up from OG Code and noted as a mix", () => {
  const out = resolveDppBagSelection({
    bagIds: ["b1", "b2"],
    ogcodeQuestionIds: ["og1", "og2", "og3"],
    targetCount: 4,
    workspaceId: "ws_A",
  });
  assert.equal(out.questionIds.length, 4);
  assert.deepEqual(out.questionIds.slice(0, 2), ["b1", "b2"], "bag questions come first");
  assert.equal(out.workspaceId, "ws_A");
  assert.match(out.provenanceNote, /mix/i);
});

test("DPP: OG fillers overlapping the bag are de-duplicated", () => {
  const out = resolveDppBagSelection({
    bagIds: ["b1", "b2"],
    ogcodeQuestionIds: ["b1", "og9"],
    targetCount: 4,
    workspaceId: "ws_A",
  });
  assert.deepEqual(out.questionIds, ["b1", "b2", "og9"]);
});

// ── Feature flags (new surfaces ship live) ──────────────────────────────────

test("new TEACHER_LAUNCH flags are enabled by default", () => {
  assert.equal(isFeatureEnabled("dppQuestionBank"), true);
  assert.equal(isFeatureEnabled("batchSyllabus"), true);
  assert.equal(isFeatureEnabled("batchHub"), true);
});

// ── Route-policy security guards for the new student-facing routes ──────────

test("student batch-hub connect routes are authenticated, never public", () => {
  for (const path of [
    "/api/connect/batches/batch_x/messages",
    "/api/connect/batches/batch_x/materials",
  ]) {
    assert.equal(getApiRoutePolicy(path).kind, "authenticated", `${path} must require a session`);
    assert.ok(
      !(PUBLIC_API_PATHS as readonly string[]).includes(path),
      `${path} must not be in the public allowlist`,
    );
  }
});

test("teacher batch syllabus/messages routes are authenticated", () => {
  for (const path of [
    "/api/teacher/workspaces/ws_x/batches/b_x/syllabus",
    "/api/teacher/workspaces/ws_x/batches/b_x/messages",
    "/api/teacher/workspaces/ws_x/batches/b_x/materials",
  ]) {
    assert.equal(getApiRoutePolicy(path).kind, "authenticated");
  }
});
