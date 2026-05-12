import test from "node:test";
import assert from "node:assert/strict";

import { handleRefresh } from "../src/legacy/users";
import { issueAccessTokenForUser, ACCESS_COOKIE_NAME, ACCESS_FINGERPRINT_COOKIE_NAME } from "../src/server/auth-jwt";
import { resetStore } from "../src/server/store";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

test("refresh endpoint treats a valid access cookie without refresh cookie as still authenticated", async () => {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  try {
    const store = resetStore();
    const user = store.users[0];
    const access = await issueAccessTokenForUser(user, "session1");
    const request = new Request("https://www.o3origin.com/api/users/token/refresh", {
      method: "POST",
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=${encodeURIComponent(access.accessToken)}; ${ACCESS_FINGERPRINT_COOKIE_NAME}=${encodeURIComponent(access.accessFingerprint)}`,
      },
    });

    const response = await handleRefresh(request, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { refreshed: false });
  } finally {
    if (previousDatabaseUrl) {
      process.env.USER_DATABASE_URL = previousDatabaseUrl;
    }
  }
});

test("refresh endpoint still rejects anonymous requests without a refresh cookie", async () => {
  const response = await handleRefresh(null, {});
  assert.equal(response.status, 400);
});
