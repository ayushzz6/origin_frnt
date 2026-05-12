import test from "node:test";
import assert from "node:assert/strict";

import { resolveApiBaseUrl } from "../src/lib/api";

test("API base URL stays same-origin for app-host API routes", () => {
  assert.equal(resolveApiBaseUrl(undefined, "https://www.o3origin.com"), "/api");
  assert.equal(resolveApiBaseUrl("https://www.o3origin.com/api", "https://www.o3origin.com"), "/api");
  assert.equal(resolveApiBaseUrl("https://www.o3origin.com/api", "https://o3origin.com"), "/api");
  assert.equal(resolveApiBaseUrl("https://origin-frnt.vercel.app/api", "https://www.o3origin.com"), "/api");
});

test("API base URL preserves real external API hosts", () => {
  assert.equal(resolveApiBaseUrl("https://api.example.com/v1", "https://www.o3origin.com"), "https://api.example.com/v1");
});
