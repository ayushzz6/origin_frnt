'use client';

/**
 * LatexRenderer — production-ready mixed text + LaTeX renderer.
 *
 * • Parses $…$ (inline) and $$…$$ (display/block) from any backend string
 * • Normalises \(…\) → $…$ and \[…\] → $$…$$ automatically
 * • Renders each math segment with KaTeX (renderToString — no DOM needed)
 * • Sanitises HTML output with DOMPurify (browser only; KaTeX is already safe)
 * • Memoised: re-parses only when `content` reference changes
 * • Graceful degradation: malformed LaTeX shows raw text, never crashes
 *
 * CSS requirement (already loaded globally in app/globals.css):
 *   @import "katex/dist/katex.min.css";
 */

import React, { useMemo } from 'react';
import katex from 'katex';
import { cn } from '@/lib/utils';

// ─── DOMPurify (browser-only, defence-in-depth) ─────────────────────────────

const MATHML_TAGS = [
  'math', 'annotation', 'semantics', 'mrow', 'mi', 'mn', 'mo',
  'mfrac', 'msup', 'msub', 'msubsup', 'msqrt', 'mover', 'munder',
  'mtable', 'mtr', 'mtd', 'mtext', 'menclose', 'mspace', 'mstyle',
] as const;

const MATHML_ATTRS = ['encoding', 'alttext', 'mathvariant', 'class', 'style'] as const;

function sanitize(html: string): string {
  if (typeof window === 'undefined') return html; // SSR: trust KaTeX output
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DP = require('dompurify') as { default?: { sanitize: (h: string, c: object) => string }; sanitize?: (h: string, c: object) => string };
    const purify = DP.default?.sanitize ?? DP.sanitize;
    if (!purify) return html;
    return purify(html, { ADD_TAGS: [...MATHML_TAGS], ADD_ATTR: [...MATHML_ATTRS] });
  } catch {
    return html;
  }
}

// ─── Segment types ───────────────────────────────────────────────────────────

type TextSeg = { kind: 'text'; value: string };
type MathSeg = { kind: 'math'; tex: string; display: boolean };
type Segment = TextSeg | MathSeg;

// ─── Delimiter normalisation ─────────────────────────────────────────────────

function normalise(raw: string): string {
  return raw
    // \[…\] → block math
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, body: string) => `\n$$${body}$$\n`)
    // \(…\) → inline math
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, body: string) => `$${body}$`)
    // √(…) → \sqrt{…}  (common in OCR / backend text)
    .replace(/√\(([^)]+)\)/g, (_m, body: string) => `$\\sqrt{${body}}$`)
    // bare √x → $\sqrt{x}$
    .replace(/√([A-Za-z0-9])/g, (_m, c: string) => `$\\sqrt{${c}}$`);
}

// ─── Parser ──────────────────────────────────────────────────────────────────

// Matches $$…$$ first (display), then $…$ (inline).
// Inline pattern intentionally excludes newlines so stray lone $ in prose
// never swallows paragraph text.
const MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^\$\n]+?)\$/g;

function parseSegments(content: string): Segment[] {
  const input = normalise(content);
  const segs: Segment[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  MATH_RE.lastIndex = 0;

  while ((m = MATH_RE.exec(input)) !== null) {
    if (m.index > cursor) {
      segs.push({ kind: 'text', value: input.slice(cursor, m.index) });
    }
    const isDisplay = m[1] !== undefined;
    segs.push({ kind: 'math', tex: (m[1] ?? m[2] ?? '').trim(), display: isDisplay });
    cursor = m.index + m[0].length;
  }

  if (cursor < input.length) {
    segs.push({ kind: 'text', value: input.slice(cursor) });
  }

  return segs;
}

// ─── KaTeX renderer ──────────────────────────────────────────────────────────

interface KatexResult {
  html: string;
  ok: boolean;
}

function renderKatex(tex: string, display: boolean): KatexResult {
  if (!tex.trim()) return { html: '', ok: true };
  try {
    const html = sanitize(
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: true,
        strict: false,      // allow unknown commands gracefully
        trust: false,       // never trust user-controlled tex
        output: 'htmlAndMathml', // MathML needed by highlight-capture.ts
      }),
    );
    return { html, ok: true };
  } catch {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[LatexRenderer] KaTeX parse error:', tex);
    }
    return { html: '', ok: false };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface LatexRendererProps {
  /** Mixed text + LaTeX string from the backend */
  content: string | null | undefined;
  /** Extra Tailwind classes on the root wrapper */
  className?: string;
  /**
   * Force all math segments to render inline regardless of $$ vs $.
   * Useful inside table cells, option lists, etc.
   */
  forceInline?: boolean;
}

/**
 * Drop-in renderer for backend question text that may contain
 * $…$ inline math and $$…$$ display math.
 *
 * @example
 * <LatexRenderer content="Solve $x^2 + 1 = 0$ for $x \in \mathbb{C}$." />
 * <LatexRenderer content="$$\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}$$" />
 */
export const LatexRenderer = React.memo(function LatexRenderer({
  content,
  className,
  forceInline = false,
}: LatexRendererProps) {
  const segments = useMemo(
    () => (content ? parseSegments(content) : []),
    [content],
  );

  if (!segments.length) return null;

  // Fast path: pure text, no math
  if (segments.every((s) => s.kind === 'text')) {
    return <span className={className}>{content}</span>;
  }

  return (
    <span className={cn('latex-root', className)}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return seg.value ? <React.Fragment key={i}>{seg.value}</React.Fragment> : null;
        }

        const isDisplay = !forceInline && seg.display;
        const { html, ok } = renderKatex(seg.tex, isDisplay);

        if (!ok) {
          // Graceful fallback: raw LaTeX between fences, clearly highlighted
          return (
            <span
              key={i}
              className="font-mono text-[0.85em] text-destructive/80 bg-destructive/5 px-1 rounded"
              title="LaTeX parse error — showing raw source"
            >
              {isDisplay ? `$$${seg.tex}$$` : `$${seg.tex}$`}
            </span>
          );
        }

        if (isDisplay) {
          return (
            <span
              key={i}
              className="latex-display-block"
              // KaTeX output sanitised above; no user HTML
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        return (
          <span
            key={i}
            className="latex-inline"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
});

export default LatexRenderer;
