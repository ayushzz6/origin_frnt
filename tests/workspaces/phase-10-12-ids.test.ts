import test from "node:test";
import assert from "node:assert/strict";

import {
  createDocumentImportJobId,
  createEnrollmentOrderId,
  createImportJobPageId,
  createImportJobQuestionId,
  createPaymentIntentId,
  createPublicInstituteId,
  createWorkspaceOfferingId,
} from "../../src/server/workspaces/ids";

test("Phase 10-12: ID generators produce prefixed IDs", () => {
  const dijobId = createDocumentImportJobId();
  assert.ok(dijobId.startsWith("dijob_"), `Expected dijobj_ prefix, got ${dijobId}`);

  const ipageId = createImportJobPageId();
  assert.ok(ipageId.startsWith("ipage_"), `Expected ipage_ prefix, got ${ipageId}`);

  const iqId = createImportJobQuestionId();
  assert.ok(iqId.startsWith("iq_"), `Expected iq_ prefix, got ${iqId}`);

  const woffId = createWorkspaceOfferingId();
  assert.ok(woffId.startsWith("woff_"), `Expected woff_ prefix, got ${woffId}`);

  const eordId = createEnrollmentOrderId();
  assert.ok(eordId.startsWith("eord_"), `Expected eord_ prefix, got ${eordId}`);

  const pintId = createPaymentIntentId();
  assert.ok(pintId.startsWith("pint_"), `Expected pint_ prefix, got ${pintId}`);

  const pinstId = createPublicInstituteId();
  assert.ok(pinstId.startsWith("pinst_"), `Expected pinst_ prefix, got ${pinstId}`);
});

test("Phase 10-12: ID generators produce unique IDs", () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    ids.add(createDocumentImportJobId());
  }
  assert.equal(ids.size, 100, "Expected 100 unique document import job IDs");
});
