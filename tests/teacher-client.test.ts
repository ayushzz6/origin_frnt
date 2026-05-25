/**
 * Regression test for the CSRF token attachment in apiJson.
 *
 * The original implementation only attached `x-csrf-token` when a
 * `json` body was passed, so DELETE (no body) and POST-with-init.body
 * went out unprotected and the server rejected them with 403 "Invalid
 * CSRF token" — reproduced on batch delete and marketplace checkout
 * in production. Fix attaches the token on every mutation method.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { apiJson } from "../src/lib/teacher-client";

type Captured = {
  url: string;
  init: RequestInit | undefined;
};

function withMockedFetchAndCookie<T>(
  cookie: string | null,
  responder: (req: Captured) => Response,
  fn: () => Promise<T>,
): Promise<{ result: T; captured: Captured[] }> {
  const captured: Captured[] = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = (globalThis as { document?: unknown }).document;

  (globalThis as { document?: unknown }).document =
    cookie === null ? { cookie: "" } : { cookie: `origin_csrf=${cookie}` };

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const req = { url, init };
    captured.push(req);
    return responder(req);
  }) as typeof fetch;

  return fn()
    .then((result) => ({ result, captured }))
    .finally(() => {
      globalThis.fetch = originalFetch;
      if (originalDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = originalDocument;
      }
    });
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  if (!init || !init.headers) return undefined;
  const map = init.headers as Record<string, string>;
  return map[name];
}

test("apiJson attaches CSRF on DELETE even with no body", async () => {
  const { captured } = await withMockedFetchAndCookie(
    "token-abc",
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    async () => {
      const r = await apiJson("/api/test/delete-me", { method: "DELETE" });
      assert.equal(r.ok, true);
    },
  );
  assert.equal(captured.length, 1);
  assert.equal(headerOf(captured[0].init, "x-csrf-token"), "token-abc");
});

test("apiJson attaches CSRF on POST + init.body without json prop", async () => {
  const { captured } = await withMockedFetchAndCookie(
    "token-xyz",
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    async () => {
      await apiJson("/api/test/upload", {
        method: "POST",
        body: new Blob(["raw"]),
      });
    },
  );
  assert.equal(headerOf(captured[0].init, "x-csrf-token"), "token-xyz");
});

test("apiJson attaches CSRF on PATCH with json body", async () => {
  const { captured } = await withMockedFetchAndCookie(
    "token-1",
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    async () => {
      await apiJson("/api/test/patch", { method: "PATCH", json: { a: 1 } });
    },
  );
  assert.equal(headerOf(captured[0].init, "x-csrf-token"), "token-1");
  assert.equal(headerOf(captured[0].init, "Content-Type"), "application/json");
});

test("apiJson skips CSRF on GET", async () => {
  const { captured } = await withMockedFetchAndCookie(
    "token-2",
    () => new Response(JSON.stringify({ rows: [] }), { status: 200 }),
    async () => {
      await apiJson("/api/test/list", { method: "GET" });
    },
  );
  assert.equal(headerOf(captured[0].init, "x-csrf-token"), undefined);
});

test("apiJson omits CSRF header when cookie is missing", async () => {
  const { captured } = await withMockedFetchAndCookie(
    null,
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    async () => {
      await apiJson("/api/test/delete-me", { method: "DELETE" });
    },
  );
  assert.equal(headerOf(captured[0].init, "x-csrf-token"), undefined);
});
