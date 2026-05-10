import test from "node:test";
import assert from "node:assert/strict";

import { normalizeDelimiters } from "../../src/components/origin-ai/FormattedMessage";

test("does not wrap trig-function substrings inside subject definitions", () => {
  const normalized = normalizeDelimiters(
    "where C-capacitance, R-resistance, l-length, E-Electric field",
  );

  assert.equal(normalized, "where C-capacitance, R-resistance, l-length, E-Electric field");
});

test("does not wrap OCR-split resistance or capacitance fragments", () => {
  const normalized = normalizeDelimiters("R-resis tance and C-capaci tance are defined");

  assert.equal(normalized, "R-resis tance and C-capaci tance are defined");
});

test("does not wrap math function names used as ordinary text", () => {
  const normalized = normalizeDelimiters("tan can be written as a ratio in trigonometry");

  assert.equal(normalized, "tan can be written as a ratio in trigonometry");
});

test("wraps real inline equations and math functions", () => {
  const normalized = normalizeDelimiters(
    String.raw`x = 1/\sqrt{\mu_0\epsilon_0}, y = E/B and z = 1/CR; use tan(theta) and log_10 x.`,
  );

  assert.match(normalized, /\$x = 1\/\\sqrt\{\\mu_0\\epsilon_0\}\$/);
  assert.match(normalized, /\$y = E\/B\$/);
  assert.match(normalized, /\$z = 1\/CR\$/);
  assert.match(normalized, /\$tan\(theta\)\$/);
  assert.match(normalized, /\$log_10 x\$/);
});

test("wraps bracketed dimension equations as complete math spans", () => {
  const normalized = normalizeDelimiters(
    String.raw`If [S] = [\alpha^2] \times [S], then [\alpha^2] must be dimensionless.`,
  );

  assert.match(normalized, /\$\[S\] = \[\\alpha\^2\] \\times \[S\]\$/);
  assert.match(normalized, /\$\[\\alpha\^2\]\$/);
  assert.doesNotMatch(normalized, /\$\\times\$/);
});

test("keeps bracketed variables with postfix exponents in the same span", () => {
  const normalized = normalizeDelimiters(
    String.raw`If [S] = [\alpha]^2 \times [S], then [\beta]^2 = [M^2L^4T^{-4}K^{-2}].`,
  );

  assert.match(normalized, /\$\[S\] = \[\\alpha\]\^2 \\times \[S\]\$/);
  assert.match(normalized, /\$\[\\beta\]\^2 = \[M\^2L\^4T\^\{-4\}K\^\{-2\}\]\$/);
  assert.doesNotMatch(normalized, /\$\[\\alpha\]\$\^2/);
});

test("keeps full bracketed dimension units together", () => {
  const normalized = normalizeDelimiters(
    String.raw`Energy per mole per Kelvin = [M L^2T^{-2}K^{-1}mol^{-1}] [J] = mechanical equivalent.`,
  );

  assert.match(normalized, /\$\[M L\^2T\^\{-2\}K\^\{-1\}mol\^\{-1\}\] \[J\]\$/);
  assert.doesNotMatch(normalized, /\[M \$L\^2/);
});

test("does not treat ordinary bracketed prose as math", () => {
  const normalized = normalizeDelimiters("Reference [see also] remains text.");

  assert.equal(normalized, "Reference [see also] remains text.");
});
