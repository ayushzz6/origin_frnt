import test from "node:test";
import assert from "node:assert/strict";

import { checkPublicationRequirements } from "../../src/server/workspaces/ogcode-publishing-service";

test("ogcode publishing: validation passes when both hint and full solution provided", () => {
  const result = checkPublicationRequirements({
    hintProvided: true,
    fullSolutionProvided: true,
  });
  assert.equal(result.valid, true);
  assert.equal(result.missingRequirements.length, 0);
});

test("ogcode publishing: validation fails when hint is missing", () => {
  const result = checkPublicationRequirements({
    hintProvided: false,
    fullSolutionProvided: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.missingRequirements.includes("hint"));
});

test("ogcode publishing: validation fails when full solution is missing", () => {
  const result = checkPublicationRequirements({
    hintProvided: true,
    fullSolutionProvided: false,
  });
  assert.equal(result.valid, false);
  assert.ok(result.missingRequirements.includes("full_solution"));
});

test("ogcode publishing: validation fails when both are missing", () => {
  const result = checkPublicationRequirements({
    hintProvided: false,
    fullSolutionProvided: false,
  });
  assert.equal(result.valid, false);
  assert.equal(result.missingRequirements.length, 2);
  assert.ok(result.missingRequirements.includes("hint"));
  assert.ok(result.missingRequirements.includes("full_solution"));
});
