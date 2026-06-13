/**
 * Select-to-ask precision — text-accuracy guarantees.
 *
 * The capture engine must hand Origin AI *exactly* what the user highlighted.
 * Plain-text selections skip the KaTeX rebuild + math-wrapping heuristic
 * entirely (both of which used to mangle prose); only genuine math selections
 * take the lossy rebuild path.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as unknown as { window: unknown }).window = dom.window;
(globalThis as unknown as { document: unknown }).document = dom.window.document;
(globalThis as unknown as { Node: unknown }).Node = dom.window.Node;

import {
  wrapUnwrappedMath,
  selectionHasKatex,
  extractSelectionText,
} from "../../src/features/origin-ai/highlight-capture";

function selectionOver(html: string): Selection {
  const container = dom.window.document.createElement("div");
  container.innerHTML = html;
  dom.window.document.body.appendChild(container);
  const range = dom.window.document.createRange();
  range.selectNodeContents(container);
  return {
    rangeCount: 1,
    getRangeAt: () => range,
    toString: () => container.textContent || "",
  } as unknown as Selection;
}

// ─── selectionHasKatex ──────────────────────────────────────────────────────

test("selectionHasKatex is false for plain prose", () => {
  assert.equal(selectionHasKatex(selectionOver("<p>Newton's first law of motion</p>")), false);
});

test("selectionHasKatex is true when the selection contains a rendered formula", () => {
  assert.equal(
    selectionHasKatex(selectionOver('<p>energy <span class="katex">E=mc^2</span> here</p>')),
    true,
  );
});

test("selectionHasKatex handles empty/absent selections", () => {
  assert.equal(selectionHasKatex(null), false);
  assert.equal(selectionHasKatex({ rangeCount: 0 } as unknown as Selection), false);
});

// ─── extractSelectionText (plain path) ──────────────────────────────────────

test("plain-text selection is returned byte-for-byte", () => {
  const text = "The mitochondria is the powerhouse of the cell";
  assert.equal(extractSelectionText(selectionOver(`<p>${text}</p>`)), text);
});

test("plain prose containing math-like words is NOT wrapped in $", () => {
  const text = "sin and cos are trig functions used widely";
  const out = extractSelectionText(selectionOver(`<p>${text}</p>`));
  assert.equal(out, text);
  assert.equal(out?.includes("$"), false);
});

// ─── wrapUnwrappedMath (pure) ───────────────────────────────────────────────

test("wrapUnwrappedMath leaves plain prose untouched", () => {
  const text = "this is a normal sentence with no math at all";
  assert.equal(wrapUnwrappedMath(text), text);
});

test("wrapUnwrappedMath never double-wraps text that already has $", () => {
  const text = "already $x^2$ wrapped";
  assert.equal(wrapUnwrappedMath(text), text);
});

test("wrapUnwrappedMath does not wrap long expressions (>100 chars)", () => {
  const text = "x^2 " + "and some trailing explanation ".repeat(5);
  assert.equal(wrapUnwrappedMath(text), text);
});
