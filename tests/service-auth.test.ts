import test from "node:test";
import assert from "node:assert/strict";

import {
  isBearerTokenAuthorized,
  readRequiredServiceToken,
  ServiceAuthConfigurationError,
} from "../src/server/service-auth";
import { requireInternal } from "../src/server/authz";

const TOKEN_NAME = "INTERNAL_CRON_TOKEN";

test("service bearer auth rejects missing token configuration", async () => {
  const previous = process.env[TOKEN_NAME];
  delete process.env[TOKEN_NAME];
  try {
    const request = new Request("https://origin.test/api/internal/refresh-catalog", {
      headers: { authorization: "Bearer anything" },
    });

    assert.equal(isBearerTokenAuthorized(request, TOKEN_NAME), false);
    assert.throws(() => readRequiredServiceToken(TOKEN_NAME), ServiceAuthConfigurationError);
    await assert.rejects(() => requireInternal(request), /Invalid internal service token/);
  } finally {
    if (previous === undefined) {
      delete process.env[TOKEN_NAME];
    } else {
      process.env[TOKEN_NAME] = previous;
    }
  }
});

test("service bearer auth accepts only exact bearer token matches", async () => {
  const previous = process.env[TOKEN_NAME];
  process.env[TOKEN_NAME] = "test-internal-token";
  try {
    const validRequest = new Request("https://origin.test/api/internal/refresh-catalog", {
      headers: { authorization: "Bearer test-internal-token" },
    });
    const invalidRequest = new Request("https://origin.test/api/internal/refresh-catalog", {
      headers: { authorization: "Bearer wrong-token" },
    });

    assert.equal(readRequiredServiceToken(TOKEN_NAME), "test-internal-token");
    assert.equal(isBearerTokenAuthorized(validRequest, TOKEN_NAME), true);
    assert.equal(isBearerTokenAuthorized(invalidRequest, TOKEN_NAME), false);
    await requireInternal(validRequest);
    await assert.rejects(() => requireInternal(invalidRequest), /Invalid internal service token/);
  } finally {
    if (previous === undefined) {
      delete process.env[TOKEN_NAME];
    } else {
      process.env[TOKEN_NAME] = previous;
    }
  }
});
