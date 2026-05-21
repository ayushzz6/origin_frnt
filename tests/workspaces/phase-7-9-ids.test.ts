import test from "node:test";
import assert from "node:assert/strict";

import {
  createAnalyticsSnapshotId,
  createOgcodePublicationId,
  createStudyMaterialAssignmentId,
  createStudyMaterialAssetId,
  createStudyMaterialId,
} from "../../src/server/workspaces/ids";

test("phase 7-9: ID generators produce prefixed IDs", () => {
  const materialId = createStudyMaterialId();
  assert.ok(materialId.startsWith("smat_"), `Expected smat_ prefix, got ${materialId}`);

  const assetId = createStudyMaterialAssetId();
  assert.ok(assetId.startsWith("sasm_"), `Expected sasm_ prefix, got ${assetId}`);

  const assignmentId = createStudyMaterialAssignmentId();
  assert.ok(assignmentId.startsWith("sasn_"), `Expected sas_ prefix, got ${assignmentId}`);

  const snapshotId = createAnalyticsSnapshotId();
  assert.ok(snapshotId.startsWith("asnap_"), `Expected asnap_ prefix, got ${snapshotId}`);

  const publicationId = createOgcodePublicationId();
  assert.ok(publicationId.startsWith("ogpub_"), `Expected ogpub_ prefix, got ${publicationId}`);
});

test("phase 7-9: ID generators produce unique IDs", () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    ids.add(createStudyMaterialId());
  }
  assert.equal(ids.size, 100, "Expected 100 unique study material IDs");
});
