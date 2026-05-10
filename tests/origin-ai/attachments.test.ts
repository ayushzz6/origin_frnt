import test from "node:test";
import assert from "node:assert/strict";

import { firstImageAttachmentUrl } from "../../src/features/origin-ai/attachments";

test("extracts the first durable image attachment URL from message metadata", () => {
  const url = firstImageAttachmentUrl({
    attachments: [
      { type: "file", url: "https://media.example.com/file.pdf" },
      { type: "image", url: "https://media.example.com/problem.png" },
    ],
  });

  assert.equal(url, "https://media.example.com/problem.png");
});

test("ignores malformed or missing image attachments", () => {
  assert.equal(firstImageAttachmentUrl({ attachments: [{ type: "image", url: "" }] }), undefined);
  assert.equal(firstImageAttachmentUrl({ attachments: "not-an-array" }), undefined);
  assert.equal(firstImageAttachmentUrl(null), undefined);
});
