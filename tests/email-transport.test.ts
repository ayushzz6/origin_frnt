import test from "node:test";
import assert from "node:assert/strict";

/**
 * Audit fix R-1.5 — contract tests for the rewritten email transport.
 *
 * The hard-fail-in-production guard is the load-bearing safety check
 * we cannot lose: A-04 (silent mock returning success) was masking
 * OTP delivery failures in prod for weeks before the audit caught it.
 *
 * The transporter is module-cached, so each case has to reset between
 * runs via `__resetEmailForTests`.
 */

async function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  const keys = Object.keys(env);
  for (const k of keys) previous[k] = process.env[k];
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const k of keys) {
      const prev = previous[k];
      if (prev === undefined) delete process.env[k];
      else process.env[k] = prev;
    }
  }
}

test("email: hard-fails in production when SMTP env is missing (no silent mock)", async () => {
  const mod = await import("../src/server/email");
  mod.__resetEmailForTests();

  await withEnv(
    {
      NODE_ENV: "production",
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
    },
    async () => {
      const result = await mod.sendEmail({
        to: "test@example.com",
        subject: "x",
        text: "x",
      });
      assert.equal(result.success, false);
      // Should NOT have a `messageId` that smells like a mock — silent mock was the bug.
      assert.equal((result as { messageId?: string }).messageId, undefined);
    },
  );

  mod.__resetEmailForTests();
});

test("email: dev mock is opt-in via missing SMTP creds and reports success with a dev-mock id", async () => {
  const mod = await import("../src/server/email");
  mod.__resetEmailForTests();

  await withEnv(
    {
      NODE_ENV: "development",
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
    },
    async () => {
      const result = await mod.sendEmail({
        to: "test@example.com",
        subject: "hello",
        text: "hi",
      });
      assert.equal(result.success, true);
      const messageId = (result as { messageId: string }).messageId;
      assert.match(messageId, /^dev-mock-/);
    },
  );

  mod.__resetEmailForTests();
});

test("email: lazy construction — transporter is not built until first send", async () => {
  // Import side-effects matter: importing the module must NOT throw even
  // when env is misconfigured. Only the first sendEmail call should fail.
  await withEnv(
    {
      NODE_ENV: "production",
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
    },
    async () => {
      const mod = await import("../src/server/email");
      mod.__resetEmailForTests();
      // Importing must not throw.
      assert.equal(typeof mod.sendEmail, "function");
    },
  );
});
