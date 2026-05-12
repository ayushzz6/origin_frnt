import test from "node:test";
import assert from "node:assert/strict";

import { getCanonicalSiteUrl } from "../src/lib/site-url";

test("canonical site URL always resolves to the public o3origin domain", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    assert.equal(getCanonicalSiteUrl(), "https://www.o3origin.com");
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
  }

  assert.equal(getCanonicalSiteUrl("https://www.o3origin.com"), "https://www.o3origin.com");
  assert.equal(getCanonicalSiteUrl("o3origin.com"), "https://www.o3origin.com");
});

test("canonical site URL refuses Vercel and malformed deployment hosts", () => {
  assert.equal(getCanonicalSiteUrl("https://origin-frnt.vercel.app"), "https://www.o3origin.com");
  assert.equal(getCanonicalSiteUrl("https://origin-ai.vercel.app"), "https://www.o3origin.com");
  assert.equal(getCanonicalSiteUrl("not a url"), "https://www.o3origin.com");
});
