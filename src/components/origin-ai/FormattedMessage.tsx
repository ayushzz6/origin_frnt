'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import type { ExtraProps } from 'react-markdown';
import type { HTMLAttributes, OlHTMLAttributes, LiHTMLAttributes, ClassAttributes } from 'react';

interface FormattedMessageProps {
  content: string;
  className?: string;
  isAssistant?: boolean;
  inline?: boolean;
}

/**
 * Normalizes common AI math delimiters to standard Markdown math delimiters ($ and $$).
 * Uses a character-level state machine to avoid the broken protect/restore regex approach.
 */
export function normalizeDelimiters(content: string): string {
  if (!content) return '';

  // Step 1: Convert \[ ... \] to $$ ... $$ and \( ... \) to $ ... $
  let result = content
    .replace(/\\\[([\s\S]*?)\\\]/g, '\n$$\n$1\n$$\n')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')
    .replace(/√\(([\s\S]*?)\)/g, '\\sqrt{$1}') // Handle √(x+y) -> \sqrt{x+y}
    .replace(/√/g, '\\sqrt '); // Fallback for bare symbol

  // Step 2: Wrap bare LaTeX expressions with $ delimiters
  result = wrapBracketedMathExpressions(result);
  result = wrapBareLaTeX(result);

  return result;
}

function wrapBracketedMathExpressions(text: string): string {
  const out: string[] = [];
  let i = 0;
  const len = text.length;

  const isGreek = (c: string): boolean => {
    const cp = c.codePointAt(0) ?? 0;
    return (cp >= 0x0370 && cp <= 0x03FF) || (cp >= 0x1F00 && cp <= 0x1FFF);
  };

  const hasGreek = (value: string): boolean => Array.from(value).some(isGreek);
  const hasSuperscript = (value: string): boolean => /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/.test(value);
  const isWeakBracketAtom = (value: string): boolean => /^[A-Za-z]{1,4}$/.test(value.trim());
  const isStrongBracketMath = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 120) return false;
    if (/\\[a-zA-Z]+/.test(trimmed) || hasGreek(trimmed) || hasSuperscript(trimmed)) return true;
    if (/[\^_=+*\/<>]|[±∞≈≠≤≥×÷√∝∠∫∬∭∮∇∂∆∑∏]/.test(trimmed)) return true;
    if (/\d/.test(trimmed)) return true;

    const parts = trimmed.split(/\s+/).filter(Boolean);
    return parts.length > 1 && parts.every((part) => /^[MLTIKNJSAQΘmolkgcd]+$/i.test(part));
  };

  const parseBracketToken = (pos: number): { end: number; strong: boolean } | null => {
    if (text[pos] !== '[') return null;
    const close = text.indexOf(']', pos + 1);
    if (close === -1) return null;

    const content = text.slice(pos + 1, close);
    if (content.includes('\n') || content.length > 120) return null;

    let end = close + 1;
    while (end < len && '^_'.includes(text[end])) {
      let scriptEnd = end + 1;
      if (text[scriptEnd] === '{') {
        let depth = 1;
        scriptEnd++;
        while (scriptEnd < len && depth > 0) {
          if (text[scriptEnd] === '{') depth++;
          if (text[scriptEnd] === '}') depth--;
          scriptEnd++;
        }
      } else {
        if (text[scriptEnd] === '+' || text[scriptEnd] === '-') scriptEnd++;
        if (text[scriptEnd] === '\\') {
          scriptEnd++;
          while (scriptEnd < len && /[a-zA-Z]/.test(text[scriptEnd])) scriptEnd++;
        } else {
          while (scriptEnd < len && /[a-zA-Z0-9]/.test(text[scriptEnd])) scriptEnd++;
        }
      }
      if (scriptEnd === end + 1) break;
      end = scriptEnd;
    }
    while (end < len && /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/.test(text[end])) end++;

    const hasPostfixScript = end > close + 1;
    const strong = hasPostfixScript || isStrongBracketMath(content);
    if (!strong && !isWeakBracketAtom(content)) return null;

    return { end, strong };
  };

  const skipInlineSpace = (pos: number): number => {
    let next = pos;
    while (next < len && (text[next] === ' ' || text[next] === '\t')) next++;
    return next;
  };

  const readMathOperator = (pos: number): number | null => {
    for (const operator of ['\\times', '\\cdot', '\\div', '\\pm']) {
      if (text.startsWith(operator, pos)) return pos + operator.length;
    }
    return '=+*\/<>×÷±≈≠≤≥'.includes(text[pos]) ? pos + 1 : null;
  };

  while (i < len) {
    if (text[i] === '$' && i + 1 < len && text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        out.push(text.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '$') {
      const end = text.indexOf('$', i + 1);
      if (end !== -1) {
        out.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    const firstToken = parseBracketToken(i);
    if (!firstToken) {
      out.push(text[i]);
      i++;
      continue;
    }

    let cursor = firstToken.end;
    let chainEnd = firstToken.end;
    let tokenCount = 1;
    let hasStrongToken = firstToken.strong;
    let hasOperator = false;

    while (cursor < len) {
      const nextStart = skipInlineSpace(cursor);
      const adjacentToken = parseBracketToken(nextStart);
      if (adjacentToken && (hasStrongToken || adjacentToken.strong)) {
        tokenCount++;
        hasStrongToken = hasStrongToken || adjacentToken.strong;
        chainEnd = adjacentToken.end;
        cursor = adjacentToken.end;
        continue;
      }

      const operatorEnd = readMathOperator(nextStart);
      if (operatorEnd === null) break;

      const afterOperator = skipInlineSpace(operatorEnd);
      const nextToken = parseBracketToken(afterOperator);
      if (!nextToken) break;

      tokenCount++;
      hasOperator = true;
      hasStrongToken = hasStrongToken || nextToken.strong;
      chainEnd = nextToken.end;
      cursor = nextToken.end;
    }

    if (hasStrongToken && (firstToken.strong || hasOperator || tokenCount > 1)) {
      out.push('$' + text.slice(i, chainEnd) + '$');
      i = chainEnd;
      continue;
    }

    out.push(text[i]);
    i++;
  }

  return out.join('');
}

/**
 * Wraps bare LaTeX expressions (starting with \command or Greek/math-symbol characters)
 * with $ delimiters, using a single-pass character-level state machine.
 * Already-delimited $...$ and $$...$$ blocks are copied verbatim without modification.
 */
function wrapBareLaTeX(text: string): string {
  const out: string[] = [];
  let i = 0;
  const len = text.length;

  const isGreek = (c: string): boolean => {
    const cp = c.codePointAt(0) ?? 0;
    return (cp >= 0x0370 && cp <= 0x03FF) || (cp >= 0x1F00 && cp <= 0x1FFF);
  };

  const isMathSymbol = (c: string): boolean =>
    '±∞≈≠≤≥×÷√∝∠∫∬∭∮∇∂∆∑∏'.includes(c);

  const isAsciiWordChar = (c: string | undefined): boolean =>
    !!c && /[a-zA-Z0-9_]/.test(c);

  const hasWordBoundaryBefore = (pos: number): boolean =>
    pos === 0 || !isAsciiWordChar(text[pos - 1]);

  const readMathFunction = (pos: number): string | null => {
    if (!hasWordBoundaryBefore(pos)) return null;

    for (const fn of ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp']) {
      if (text.slice(pos, pos + fn.length).toLowerCase() !== fn) continue;
      if (/[a-zA-Z0-9]/.test(text[pos + fn.length] ?? '')) continue;

      let next = pos + fn.length;
      while (next < len && (text[next] === ' ' || text[next] === '\t')) next++;

      if (next >= len) return null;

      const nextChar = text[next];
      if (/[a-zA-Z]/.test(nextChar)) {
        let tokenEnd = next + 1;
        while (tokenEnd < len && /[a-zA-Z]/.test(text[tokenEnd])) tokenEnd++;

        const token = text.slice(next, tokenEnd).toLowerCase();
        const knownWordVariable = ['theta', 'alpha', 'beta', 'gamma', 'delta', 'phi', 'pi'].includes(token);
        if (token.length > 2 && !knownWordVariable) continue;
      }

      if (
        '(^_\\'.includes(nextChar) ||
        /[a-zA-Z0-9]/.test(nextChar) ||
        isGreek(nextChar) ||
        isMathSymbol(nextChar)
      ) {
        return fn;
      }
    }

    return null;
  };

  const looksLikeNumericMathStart = (pos: number): boolean => {
    if (!/[0-9]/.test(text[pos])) return false;

    const candidate = text.slice(pos, Math.min(len, pos + 32));
    return /(?:\\[a-zA-Z]+|[=+*\/^_<>]|[±∞≈≠≤≥×÷√∝∠∫∬∭∮∇∂∆∑∏])/.test(candidate);
  };

  const looksLikeVariableMathStart = (pos: number): boolean => {
    if (!hasWordBoundaryBefore(pos) || !/[a-zA-Z]/.test(text[pos])) return false;

    let end = pos + 1;
    while (end < len && /[a-zA-Z0-9]/.test(text[end])) end++;
    if (end - pos > 3) return false;

    let next = end;
    while (next < len && (text[next] === ' ' || text[next] === '\t')) next++;

    if (next >= len) return false;
    // Don't treat fill-blank underscores (__ or more) as a math operator
    if (text[next] === '_' && next + 1 < len && text[next + 1] === '_') return false;
    return '=+*/^_<>'.includes(text[next]);
  };

  // Peek ahead from position pos (skipping spaces) and check if what follows
  // looks like math (LaTeX command, Greek, math symbol, or ^ _)
  const nextIsMath = (pos: number): boolean => {
    let k = pos;
    while (k < len && (text[k] === ' ' || text[k] === '\t')) k++;
    if (k >= len) return false;
    const c = text[k];

    return (
      c === '\\' ||
      '=+*/<>'.includes(c) ||
      isGreek(c) ||
      isMathSymbol(c) ||
      '^_'.includes(c) ||
      readMathFunction(k) !== null ||
      looksLikeNumericMathStart(k) ||
      looksLikeVariableMathStart(k)
    );
  };

  while (i < len) {
    // ── Case 1: $$ ... $$ block ───────────────────────────────────────────
    if (text[i] === '$' && i + 1 < len && text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        out.push(text.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    // ── Case 2: $ ... $ block ─────────────────────────────────────────────
    if (text[i] === '$') {
      const end = text.indexOf('$', i + 1);
      if (end !== -1) {
        out.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // ── Case 3: Bare LaTeX starting point ─────────────────────────────────
    const isLatexCmd = text[i] === '\\' && i + 1 < len && /[a-zA-Z]/.test(text[i + 1]);
    const isSpecial = isGreek(text[i]) || isMathSymbol(text[i]);
    const isNumericMath = looksLikeNumericMathStart(i);
    const isVariableMath = looksLikeVariableMathStart(i);
    const isMathWord = readMathFunction(i) !== null;

    if (isLatexCmd || isSpecial || isNumericMath || isVariableMath || isMathWord) {
      const mathStart = i;
      let braceDepth = 0;
      let j = i;

      while (j < len) {
        const c = text[j];

        // ── Inside braces: consume everything including nested parens ──
        if (c === '{') { braceDepth++; j++; continue; }
        if (c === '}') {
          if (braceDepth > 0) { braceDepth--; j++; continue; }
          break; // unmatched } – stop
        }
        if (braceDepth > 0) { j++; continue; }

        // ── Outside braces ─────────────────────────────────────────────
        // LaTeX command word
        if (c === '\\' && j + 1 < len && /[a-zA-Z]/.test(text[j + 1])) {
          const cmdStart = j + 1;
          j += 2;
          while (j < len && /[a-zA-Z]/.test(text[j])) j++;
          const cmdWord = text.slice(cmdStart, j);
          // \left, \right, \bigl, \bigr, \Big, \Bigg etc. are followed by
          // a single delimiter character that MUST stay inside the math block
          if (/^(left|right|[Bb]ig[lr]?[lr]?|[Bb]igg[lr]?|middle)$/.test(cmdWord)) {
            // Consume the delimiter: (, ), [, ], |, ., \{, \}
            if (j < len) {
              if (text[j] === '\\' && j + 1 < len && /[{}|]/.test(text[j + 1])) {
                j += 2; // e.g. \left\{ or \right\}
              } else {
                j++; // e.g. \left( or \right)
              }
            }
          }
          continue;
        }

        // Superscript / subscript — stop on consecutive underscores (fill-blank: __, ___, etc.)
        if ('^_'.includes(c)) {
          if (c === '_' && j + 1 < len && text[j + 1] === '_') break;
          j++; continue;
        }

        // Operators, digits, and grouping symbols
        if (/[0-9+\-*\/=<>!|&~%()[\]]/.test(c)) { j++; continue; }

        // Greek or math symbols
        if (isGreek(c) || isMathSymbol(c)) { j++; continue; }

        // Single letters (variable names)
        if (/[a-zA-Z]/.test(c)) { j++; continue; }

        // Space / tab: allow only when next non-space token is math-like
        if (c === ' ' || c === '\t') {
          if (nextIsMath(j + 1)) { j++; continue; }
          // Allow single letter variables after space, e.g. "\sqrt x"
          let k = j + 1;
          while (k < len && (text[k] === ' ' || text[k] === '\t')) k++;
          if (k < len && /[a-zA-Z]/.test(text[k])) {
             // check if it's a single letter followed by space, punctuation, or math
             if (k + 1 >= len || /[\s.,;:)\]]/.test(text[k + 1]) || nextIsMath(k + 1)) {
                 j++; continue;
             }
          }
          // Also allow if a digit follows and THEN math (e.g. "2\theta")
          k = j + 1;
          while (k < len && /[0-9]/.test(text[k])) k++;
          if (k > j + 1 && nextIsMath(k)) { j++; continue; }
          break;
        }

        // Everything else – stop
        break;
      }

      // Trim trailing whitespace / punctuation that shouldn't end math
      let mathEnd = j;
      while (mathEnd > mathStart && /[\s.,;:]/.test(text[mathEnd - 1])) mathEnd--;

      const mathContent = text.slice(mathStart, mathEnd);
      if (mathContent.length > 0) {
        out.push('$' + mathContent + '$');
        i = mathEnd;
      } else {
        out.push(text[i]);
        i++;
      }
      continue;
    }

    // ── Case 4: Regular character ─────────────────────────────────────────
    out.push(text[i]);
    i++;
  }

  return out.join('');
}

type PProps = ClassAttributes<HTMLParagraphElement> & HTMLAttributes<HTMLParagraphElement> & ExtraProps;
type UlProps = ClassAttributes<HTMLUListElement> & HTMLAttributes<HTMLUListElement> & ExtraProps;
type OlProps = ClassAttributes<HTMLOListElement> & OlHTMLAttributes<HTMLOListElement> & ExtraProps;
type LiProps = ClassAttributes<HTMLLIElement> & LiHTMLAttributes<HTMLLIElement> & ExtraProps;
type StrongProps = ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps;
type DivProps = ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement> & ExtraProps;

export function FormattedMessage({ content, className, isAssistant = true, inline = false }: FormattedMessageProps) {
  const normalizedContent = normalizeDelimiters(content);
  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper className={cn(
      !inline && 'prose prose-sm max-w-none',
      !inline && !className?.includes('prose-invert') && 'dark:prose-invert',
      !inline && 'prose-p:leading-relaxed prose-p:my-1',
      !inline && 'prose-ul:my-2 prose-ol:my-2',
      !inline && 'prose-li:my-0.5',
      !inline && 'prose-strong:text-primary prose-strong:font-bold',
      !inline && 'select-text cursor-text',
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children, node, ...rest }: PProps) =>
            inline ? <>{children}</> : <p className="mb-2 last:mb-0 select-text" {...rest}>{children}</p>,
          ul: ({ children, node, ...rest }: UlProps) =>
            <ul className="list-disc pl-5 mb-2 space-y-1" {...rest}>{children}</ul>,
          ol: ({ children, node, ...rest }: OlProps) =>
            <ol className="list-decimal pl-5 mb-2 space-y-1" {...rest}>{children}</ol>,
          li: ({ children, node, ...rest }: LiProps) =>
            <li className="leading-relaxed select-text" {...rest}>{children}</li>,
          strong: ({ children, node, ...rest }: StrongProps) =>
            <strong className="font-bold" {...rest}>{children}</strong>,
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </Wrapper>
  );
}
