import test from "node:test";
import assert from "node:assert/strict";

import { isMutatingRoleAllowed, workspaceMembersThatCanWrite } from "../../src/server/workspaces/authz";

test("teacher/content_manager/admin/owner can mutate", () => {
  assert.equal(isMutatingRoleAllowed("owner"), true);
  assert.equal(isMutatingRoleAllowed("admin"), true);
  assert.equal(isMutatingRoleAllowed("teacher"), true);
  assert.equal(isMutatingRoleAllowed("content_manager"), true);
});

test("analyst/support cannot mutate", () => {
  assert.equal(isMutatingRoleAllowed("analyst"), false);
  assert.equal(isMutatingRoleAllowed("support"), false);
  assert.equal(workspaceMembersThatCanWrite("analyst"), false);
  assert.equal(workspaceMembersThatCanWrite("support"), false);
});
