import test from "node:test";
import assert from "node:assert/strict";

import { canonicalHostRedirectUrl } from "../src/middleware";

test("apex production host redirects to canonical www host", () => {
  const redirect = canonicalHostRedirectUrl(new URL("https://o3origin.com/dashboard?tab=ogcode"));
  assert.equal(redirect?.toString(), "https://www.o3origin.com/dashboard?tab=ogcode");
});

test("canonical and preview hosts are not rewritten by middleware helper", () => {
  assert.equal(canonicalHostRedirectUrl(new URL("https://www.o3origin.com/dashboard")), null);
  assert.equal(canonicalHostRedirectUrl(new URL("https://origin-frnt.vercel.app/dashboard")), null);
});
