'use client';

import type { ReactNode } from 'react';

const LATEX_COMMAND_MAP: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  eta: 'η',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  phi: 'φ',
  omega: 'ω',
  times: '×',
  cdot: '·',
  circ: '°',
  pm: '±',
  mp: '∓',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  infty: '∞',
  propto: '∝',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
};

const FUNCTION_COMMANDS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'max', 'min'];

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
  r: 'ʳ',
  x: 'ˣ',
  y: 'ʸ',
  z: 'ᶻ',
  a: 'ᵃ',
  b: 'ᵇ',
  c: 'ᶜ',
  d: 'ᵈ',
  e: 'ᵉ',
  f: 'ᶠ',
  g: 'ᵍ',
  h: 'ʰ',
  j: 'ʲ',
  k: 'ᵏ',
  l: 'ˡ',
  m: 'ᵐ',
  o: 'ᵒ',
  p: 'ᵖ',
  s: 'ˢ',
  t: 'ᵗ',
  u: 'ᵘ',
  v: 'ᵛ',
  w: 'ʷ',
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  e: 'ₑ',
  a: 'ₐ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
};

function mapDecoratedText(value: string, alphabet: Record<string, string>): string {
  return Array.from(value).map((char) => alphabet[char] ?? char).join('');
}

function decodeEscapedUnicode(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function extractBalancedSegment(value: string, startIndex: number, openChar: string, closeChar: string) {
  if (value[startIndex] !== openChar) {
    return null;
  }

  let depth = 0;
  let cursor = startIndex;
  for (; cursor < value.length; cursor += 1) {
    const current = value[cursor];
    if (current === openChar) {
      depth += 1;
    } else if (current === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: value.slice(startIndex + 1, cursor),
          endIndex: cursor,
        };
      }
    }
  }

  return null;
}

function replaceFractions(value: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < value.length) {
    if (value.startsWith('\\frac', cursor)) {
      let nextCursor = cursor + 5;
      while (value[nextCursor] === ' ') {
        nextCursor += 1;
      }

      const numerator = extractBalancedSegment(value, nextCursor, '{', '}');
      if (!numerator) {
        output += value[cursor];
        cursor += 1;
        continue;
      }

      nextCursor = numerator.endIndex + 1;
      while (value[nextCursor] === ' ') {
        nextCursor += 1;
      }

      const denominator = extractBalancedSegment(value, nextCursor, '{', '}');
      if (!denominator) {
        output += value[cursor];
        cursor += 1;
        continue;
      }

      output += `(${formatMathExpression(numerator.content)})/(${formatMathExpression(denominator.content)})`;
      cursor = denominator.endIndex + 1;
      continue;
    }

    output += value[cursor];
    cursor += 1;
  }

  return output;
}

function replaceSquareRoots(value: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < value.length) {
    if (value.startsWith('\\sqrt', cursor) || value[cursor] === '√') {
      cursor += value.startsWith('\\sqrt', cursor) ? 5 : 1;
      while (value[cursor] === ' ') {
        cursor += 1;
      }

      if (value[cursor] === '{' || value[cursor] === '(') {
        const openChar = value[cursor];
        const closeChar = openChar === '{' ? '}' : ')';
        const segment = extractBalancedSegment(value, cursor, openChar, closeChar);
        if (segment) {
          output += `√(${formatMathExpression(segment.content)})`;
          cursor = segment.endIndex + 1;
          continue;
        }
      }

      const tokenMatch = value.slice(cursor).match(/^[a-zA-Z0-9.]+/);
      if (tokenMatch) {
        output += `√(${tokenMatch[0]})`;
        cursor += tokenMatch[0].length;
        continue;
      }

      output += '√';
      continue;
    }

    output += value[cursor];
    cursor += 1;
  }

  return output;
}

function repairPlainMathCommands(value: string): string {
  return value
    .replace(/\bsqrt\s*\(/g, '√(')
    .replace(/\blog_\{?e\}?/g, 'logₑ')
    .replace(/\^\s*circ\b/g, '°');
}

export function formatMathExpression(input: string | null | undefined): string {
  let value = String(input ?? '').trim();
  if (!value) {
    return '';
  }

  value = decodeEscapedUnicode(value)
    .replace(/\\\\([A-Za-z])/g, '\\$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/[\u2212\u2013\u2014]/g, '-');

  value = replaceFractions(value);
  value = replaceSquareRoots(value);

  value = value
    .replace(/\\text\s*{([^{}]+)}/g, '$1')
    .replace(/\\operatorname\s*{([^{}]+)}/g, '$1')
    .replace(/\\log_\{?e\}?/g, 'logₑ')
    .replace(/\blog_e\b/g, 'logₑ')
    .replace(/\bsqrt\s*\(/g, '√(')
    .replace(/\^\s*\\circ\b/g, '°')
    .replace(/\^\s*circ\b/g, '°');

  Object.entries(LATEX_COMMAND_MAP).forEach(([command, symbol]) => {
    value = value.replace(new RegExp(`\\\\${command}\\b`, 'g'), symbol);
  });

  FUNCTION_COMMANDS.forEach((command) => {
    value = value.replace(new RegExp(`\\\\${command}\\b`, 'g'), command);
  });

  value = value
    .replace(/\\([A-Za-z]+)/g, '$1')
    .replace(/\^\{([^{}]+)\}/g, (_match, exponent: string) => mapDecoratedText(exponent, SUPERSCRIPT_DIGITS))
    .replace(/_\{([^{}]+)\}/g, (_match, subscript: string) => mapDecoratedText(subscript, SUBSCRIPT_DIGITS))
    .replace(/\^([a-zA-Z0-9+\-()=]+)/g, (_match, exponent: string) => mapDecoratedText(exponent, SUPERSCRIPT_DIGITS))
    .replace(/_([a-zA-Z0-9+\-()=]+)/g, (_match, subscript: string) => mapDecoratedText(subscript, SUBSCRIPT_DIGITS))
    .replace(/\^°/g, '°')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();

  return repairPlainMathCommands(value);
}

export function hasMathMarkup(value: string | null | undefined): boolean {
  const text = String(value ?? '');
  return /\\\(|\\\)|\\[a-zA-Z]+|\\u[0-9a-fA-F]{4}|√|[\^_$]/.test(text);
}

function isEquationHeavyLine(value: string): boolean {
  const text = value.replace(/\*\*/g, '').trim();
  if (!text) {
    return false;
  }

  const latexSignalCount = [
    /\\frac/g,
    /\\sqrt/g,
    /\\(?:tan|sin|cos|cot|sec|csc|log|ln)\b/g,
    /\\(?:alpha|beta|gamma|delta|eta|theta|lambda|mu|pi|sigma|phi|omega)\b/g,
  ].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);

  const symbolSignalCount = [
    /=/g,
    /→/g,
    /∝/g,
    /√/g,
    /\//g,
  ].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);

  const startsLikeEquation = /^((\\)?(?:tan|sin|cos|cot|sec|csc|log|ln)\s*\(|[A-Za-zα-ωΑ-Ωβθηλμπσφω][A-Za-z0-9_{}\\^()]*\s*=|[0-9(\\√])/i.test(text);
  const hasEquationCore = /=/.test(text) || /\\frac|\\sqrt|\\(?:tan|sin|cos|cot|sec|csc|log|ln)\b/.test(text);

  return (hasEquationCore && (latexSignalCount + symbolSignalCount >= 2 || startsLikeEquation))
    || (startsLikeEquation && latexSignalCount >= 1);
}

type InlineMathVariant = 'chip' | 'plain';

export function renderInlineSegments(
  value: string,
  keyPrefix: string,
  variant: InlineMathVariant = 'chip',
): ReactNode[] {
  const content = value.replace(/\*\*/g, '').trim();
  if (!content) {
    return [];
  }

  const pattern = /\\\((.+?)\\\)|\$\$(.+?)\$\$|\$(.+?)\$/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let segmentIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;
    const textPart = content.slice(cursor, matchIndex);
    if (textPart) {
      nodes.push(
        <span key={`${keyPrefix}-text-${segmentIndex}`}>
          {hasMathMarkup(textPart) ? formatMathExpression(textPart) : textPart}
        </span>,
      );
      segmentIndex += 1;
    }

    const mathContent = match[1] ?? match[2] ?? match[3] ?? '';
    nodes.push(
      <span
        key={`${keyPrefix}-math-${segmentIndex}`}
        className={
          variant === 'plain'
            ? 'inline font-mono text-[0.98em] text-current'
            : 'inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[0.95em] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100'
        }
      >
        {formatMathExpression(mathContent)}
      </span>,
    );
    segmentIndex += 1;
    cursor = matchIndex + match[0].length;
  }

  const trailingText = content.slice(cursor);
  if (trailingText) {
    nodes.push(
      <span key={`${keyPrefix}-tail-${segmentIndex}`}>
        {hasMathMarkup(trailingText) ? formatMathExpression(trailingText) : trailingText}
      </span>,
    );
  }

  return nodes;
}

export function renderFormattedExplanation(content: string | null | undefined): ReactNode {
  const lines = String(content ?? '').split('\n');

  return (
    <div className="space-y-3">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={`space-${index}`} className="h-1" />;
        }

        const headingMatch = line.match(/^\*\*(.+)\*\*$/);
        if (headingMatch) {
          return (
            <div key={`heading-${index}`} className="pt-1">
              <h4 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
                {headingMatch[1]}
              </h4>
            </div>
          );
        }

        const bulletMatch = line.match(/^- (.+)$/);
        if (bulletMatch) {
          return (
            <div key={`bullet-${index}`} className="flex gap-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="mt-[2px] text-slate-400 dark:text-slate-500">•</span>
              <div className="flex-1">{renderInlineSegments(bulletMatch[1], `bullet-${index}`)}</div>
            </div>
          );
        }

        const blockMathMatch = line.match(/^\\\((.+)\\\)$/);
        if (blockMathMatch) {
          return (
            <div
              key={`math-${index}`}
              className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 font-mono text-sm text-blue-700 dark:text-blue-100"
            >
              {formatMathExpression(blockMathMatch[1])}
            </div>
          );
        }

        if (isEquationHeavyLine(line)) {
          return (
            <div
              key={`equation-${index}`}
              className="rounded-xl border border-blue-400/20 bg-gradient-to-r from-blue-500/12 via-blue-500/8 to-cyan-500/10 px-4 py-3 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]"
            >
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-blue-300/80">
                Key Equation
              </div>
              <div className="font-mono text-sm leading-relaxed text-blue-100">
                {renderInlineSegments(line, `equation-${index}`)}
              </div>
            </div>
          );
        }

        return (
          <p key={`line-${index}`} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {renderInlineSegments(line, `line-${index}`)}
          </p>
        );
      })}
    </div>
  );
}

export function renderQuestionText(content: string | null | undefined, keyPrefix: string): ReactNode {
  const lines = String(content ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <p key={`${keyPrefix}-${index}`} className="leading-relaxed">
          {renderInlineSegments(line, `${keyPrefix}-${index}`)}
        </p>
      ))}
    </div>
  );
}
