'use client';

import React from 'react';

type Listener = (text: string | null) => void;
type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
type HighlightSelection = {
  text: string | null;
  rect: HighlightRect | null;
};
type SelectionListener = (selection: HighlightSelection) => void;

let currentHighlight: string | null = null;
let currentHighlightRect: HighlightRect | null = null;
// The locked Range is captured on mouseup and held for CSS Highlight API persistence.
// We keep it as a live Range (not re-cloned) so the browser tracks DOM position updates.
let lockedRange: Range | null = null;

let lastValidHighlight: string | null = null;
let lastValidHighlightTs: number = 0;
const HIGHLIGHT_RETAIN_MS = 3_000;
const listeners = new Set<Listener>();
const selectionListeners = new Set<SelectionListener>();

let isMouseDown = false;

// ─── CSS Highlight API helpers ──────────────────────────────────────────────

function isCSSHighlightSupported(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    !!(CSS as unknown as Record<string, unknown>).highlights &&
    typeof window !== 'undefined' &&
    !!(window as unknown as Record<string, unknown>).Highlight
  );
}

function applyCSShighlight(range?: Range | null): void {
  if (!isCSSHighlightSupported()) return;
  const r = range ?? lockedRange;
  if (!r || r.collapsed) return;

  // If the range's container was removed from the DOM (React replaced the node),
  // the highlight would render nothing. Skip silently.
  try {
    if (!document.contains(r.startContainer) || !document.contains(r.endContainer)) return;
    // A re-applied range whose geometry has collapsed to nothing (node reflowed
    // away) would otherwise paint a stale/expanded mark — drop it instead.
    if (r.getClientRects().length === 0) return;
    const hl = new (window as unknown as { Highlight: new (...ranges: Range[]) => unknown }).Highlight(r);
    (CSS as unknown as { highlights: { set(name: string, hl: unknown): void } }).highlights.set('origin-ai-selection', hl);
  } catch (_) {}
}

function removeCSShighlight(): void {
  if (!isCSSHighlightSupported()) return;
  try {
    (CSS as unknown as { highlights: { delete(name: string): void } }).highlights.delete('origin-ai-selection');
  } catch (_) {}
}

// ─── Core emit ──────────────────────────────────────────────────────────────

function emitChange() {
  listeners.forEach((l) => l(currentHighlight));
  selectionListeners.forEach((l) => l({ text: currentHighlight, rect: currentHighlightRect }));
  // NOTE: the persistent CSS Highlight mark is painted explicitly in
  // captureSelection() at finalise time — it is never re-applied here. The old
  // double-rAF re-application repainted a stale/expanded lockedRange after React
  // reconciliation, which is what made the highlight grow to cover a whole
  // block. The browser's native ::selection already tracks the live drag.
}

// ─── Geometry ───────────────────────────────────────────────────────────────

function getSelectionRect(selection: Selection | null): HighlightRect | null {
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  // Anchor to the LAST line box of the selection (where the drag ends) rather
  // than the full multi-line bounding box. For a single-line selection these
  // are identical; for a multi-line one this puts the pill at the end of the
  // selection instead of floating over its centre, which reads as imprecise.
  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

// ─── Text extraction ─────────────────────────────────────────────────────────

/**
 * True only when the *selected* content actually contains a rendered KaTeX node.
 * We clone the selection's contents (not the surrounding DOM) so a math formula
 * sitting elsewhere in the same paragraph never counts. Plain-text selections
 * return false and skip the lossy rebuild entirely — keeping captured text
 * byte-identical to what the user highlighted.
 */
export function selectionHasKatex(selection: Selection | null): boolean {
  if (!selection || selection.rangeCount === 0) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    const frag = selection.getRangeAt(i).cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);
    if (div.querySelector('.katex')) return true;
  }
  return false;
}

export function extractSelectionText(selection: Selection | null): string | null {
  if (!selection || selection.rangeCount === 0) return null;

  if (isMouseDown) return selection.toString().trim() || null;

  // Plain-text selections: return exactly what the user selected. No KaTeX
  // surgery and no math-wrapping heuristic — both of which can mangle prose.
  if (!selectionHasKatex(selection)) return selection.toString().trim() || null;

  let extractedText = '';

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const frag = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);

    const katexNodes = Array.from(div.querySelectorAll('.katex'));
    katexNodes.sort((a, b) => b.querySelectorAll('*').length - a.querySelectorAll('*').length);

    katexNodes.forEach((node) => {
      if (!div.contains(node)) return;
      const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
      const mathElement = node.querySelector('math');
      const ariaLabel = node.getAttribute('aria-label');
      const tex = (annotation?.textContent || mathElement?.getAttribute('alttext') || ariaLabel || '').trim();

      if (tex && !tex.includes('$./')) {
        const isDisplay = node.classList.contains('katex-display') || !!node.querySelector('.katex-display');
        const delimiter = isDisplay ? '$$' : '$';
        node.replaceWith(document.createTextNode(`${delimiter}${tex}${delimiter}`));
      } else {
        node.querySelectorAll('.katex-html, .katex-mathml').forEach((n) => n.remove());
        if (node.classList.contains('katex') && !node.textContent?.trim()) node.remove();
      }
    });

    div.querySelectorAll('.katex-html, .katex-mathml, .katex-display, .vlist, .strut, .base, .mord, .msupsub').forEach((n) => n.remove());

    div.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;white-space:pre-wrap';
    document.body.appendChild(div);
    extractedText += div.innerText;
    document.body.removeChild(div);
  }

  return wrapUnwrappedMath(extractedText.trim()) || null;
}

export function wrapUnwrappedMath(text: string): string {
  if (!text || text.includes('$')) return text;

  const mathCommands = [
    '\\\\frac', '\\\\sqrt', '\\\\sum', '\\\\int', '\\\\alpha', '\\\\beta', '\\\\gamma',
    '\\\\delta', '\\\\theta', '\\\\lambda', '\\\\pi', '\\\\sigma', '\\\\omega',
    '\\\\infty', '\\\\partial', '\\\\nabla', '\\\\times', '\\\\div', '\\\\pm',
    '\\\\le', '\\\\ge', '\\\\ne', '\\\\approx', '\\\\equiv', '\\\\forall', '\\\\exists',
    '\\\\cos', '\\\\sin', '\\\\tan', '\\\\log', '\\\\ln',
  ];
  const mathPatterns = [
    /[a-zA-Z0-9]\^[0-9\-+]/,
    /[a-zA-Z0-9]_[0-9]/,
    /[ijk]\s*[+-]\s*[ijk]/,
    /[a-zA-Z]\s*=\s*[a-zA-Z0-9+-]/,
    /(sin|cos|tan)\^?-?[0-9]?/,
  ];

  const cmdRegex = new RegExp(`(${mathCommands.join('|')})`, 'i');
  if (!cmdRegex.test(text) && !mathPatterns.some((p) => p.test(text))) return text;

  const spaces = (text.match(/ /g) || []).length;
  if (spaces > 5 || text.length > 100) return text;
  return text.includes('\n') ? `$$\n${text}\n$$` : `$${text}$`;
}

// ─── Selection capture ────────────────────────────────────────────────────────

/**
 * Capture the current selection in a single pass: KaTeX-aware text, the pill
 * anchor rect, and — when `paint` is set — the persistent CSS Highlight mark.
 * Called once when a selection is finalised (mouseup/touchend), never on every
 * intermediate selectionchange during a drag.
 */
function captureSelection(paint: boolean): void {
  const selection = window.getSelection();
  const text = selection?.toString().trim() || null;

  if (!text) {
    // Empty selection (e.g. focus moved to a text field).
    // Do NOT clear currentHighlight here — let handleGlobalClick decide.
    return;
  }

  // Selections that originate inside the Origin AI panel are chat content, not page context.
  const anchorNode = selection?.anchorNode;
  const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;
  if (anchorEl?.closest('[data-origin-ai-root="true"]')) {
    clearHighlightedText();
    return;
  }

  // extractSelectionText returns the verbatim string for plain-text selections
  // and only does KaTeX surgery when the selection actually contains math.
  currentHighlight = extractSelectionText(selection) || text;
  currentHighlightRect = getSelectionRect(selection);

  if (paint && selection && selection.rangeCount > 0) {
    // Lock in a live Range and paint the persistent mark ONCE, over exactly the
    // finalised selection. It is never re-applied on later emits.
    lockedRange = selection.getRangeAt(0);
    applyCSShighlight(lockedRange);
  }

  emitChange();
}

// ─── Selection change handler ─────────────────────────────────────────────────

function handleSelectionChange() {
  // During an active mouse/touch drag we deliberately neither capture nor emit.
  // Notifying subscribers on every selectionchange re-renders heavy consumers
  // (DoubtSolver / OriginAiMentor → ReactMarkdown + KaTeX) mid-drag; that reflows
  // the very text being dragged over and makes the native selection jump to a
  // whole block. The browser's ::selection shows the drag live; we finalise on
  // mouseup/touchend (finaliseSelection). Keyboard selection has no drag, so it
  // still captures here (without painting the persistent mark).
  if (isMouseDown) return;
  captureSelection(false);
}

// ─── Mouse lifecycle ──────────────────────────────────────────────────────────

// Marks a selection interaction as in-progress so handleSelectionChange stops
// capturing/emitting until it finalises. Shared by mouse and touch so neither
// desktop drags nor mobile selection-handle drags churn React mid-selection.
function beginInteraction(target: Element | null): void {
  isMouseDown = true;

  // Starting a fresh drag on the page: drop the previous persistent highlight
  // now so it can never linger as a stale rose "block" behind the new selection.
  // Presses on the pill / AI panel are left alone — the pill relies on the
  // snapshot taken in its own onMouseDown handler.
  if (target?.closest('[data-origin-ai-root="true"]')) return;
  if (currentHighlight || lockedRange) clearHighlightedText();
}

function handleMouseDown(event: MouseEvent) {
  beginInteraction(event.target as Element | null);
}

function handleTouchStart(event: TouchEvent) {
  beginInteraction(event.target as Element | null);
}

function finaliseSelection(): void {
  isMouseDown = false;
  // Capture once, now that the drag is finished: text + pill rect + the
  // persistent highlight mark, all from the final selection in a single pass.
  captureSelection(true);
}

function handleMouseUp() {
  finaliseSelection();
}

// Mobile: touchend fires instead of mouseup after the user lifts their finger
function handleTouchEnd() {
  // Small delay so the browser has time to update window.getSelection()
  setTimeout(finaliseSelection, 50);
}

// ─── Click handler — clear only on genuine "blank area" clicks ───────────────

/**
 * Returns true only for a click on a genuinely empty / layout area of the
 * page — not on text, interactive elements, or the Origin AI panel.
 *
 * Key rule: we check DIRECT text nodes of the clicked element, not its full
 * subtree. A layout <div> wrapping paragraphs has no direct text → blank.
 * A <p> element has direct text → not blank (and is caught by .closest() too).
 */
function isBlankSpace(target: Element | null): boolean {
  if (!target) return true;

  // Never clear inside Origin AI, sidebars, dialogs, or tutorial overlays.
  if (
    target.closest('[data-origin-ai-root="true"]') ||
    target.closest('aside') ||
    target.closest('[role="dialog"]') ||
    target.closest('#tutorial-overlay')
  ) return false;

  // Never clear when clicking interactive elements.
  if (target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]')) return false;

  // Never clear when clicking known text/content or media elements.
  if (target.closest('p, span, h1, h2, h3, h4, h5, h6, li, code, pre, strong, em, b, i, sub, sup, blockquote, td, th, label, img, svg, figure, video, canvas')) return false;

  // Check only DIRECT text-node children — not the full subtree.
  // A layout container (div, section, main) that wraps content has no direct
  // text nodes and is correctly treated as blank space.
  const hasDirectText = Array.from(target.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent?.trim().length ?? 0) > 0,
  );
  if (hasDirectText) return false;

  return true;
}

function handleGlobalClick(event: MouseEvent) {
  const target = event.target as Element | null;

  if (target?.closest('[data-origin-ai-root="true"]')) return;

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || '';

  // Keep the highlight if the user still has an active selection (e.g., end of drag).
  if (selectedText) return;

  // Clear only when the click lands on a genuinely blank area.
  if (isBlankSpace(target)) clearHighlightedText();
}

// ─── Listener registration ────────────────────────────────────────────────────

let isListening = false;

export function startHighlightCapture(): void {
  if (typeof window === 'undefined' || isListening) return;
  isListening = true;
  document.addEventListener('selectionchange', handleSelectionChange);
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  window.addEventListener('click', handleGlobalClick);
}

export function stopHighlightCapture(): void {
  if (typeof window === 'undefined') return;
  isListening = false;
  document.removeEventListener('selectionchange', handleSelectionChange);
  window.removeEventListener('mousedown', handleMouseDown);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('touchstart', handleTouchStart);
  window.removeEventListener('touchend', handleTouchEnd);
  window.removeEventListener('click', handleGlobalClick);
  clearHighlightedText();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function clearHighlightedText(): void {
  currentHighlight = null;
  currentHighlightRect = null;
  lockedRange = null;
  removeCSShighlight();
  emitChange();
}

export function setManualSelection(text: string | null, rect?: HighlightRect | null): void {
  currentHighlight = text;
  currentHighlightRect = rect || null;
  emitChange();
}

export function getHighlightedText(): string | null {
  return currentHighlight;
}

export function snapshotHighlightedText(): void {
  if (currentHighlight) {
    lastValidHighlight = currentHighlight;
    lastValidHighlightTs = Date.now();
  }
}

export function getPendingHighlightedText(): string | null {
  if (currentHighlight) return currentHighlight;
  if (lastValidHighlight && Date.now() - lastValidHighlightTs < HIGHLIGHT_RETAIN_MS) {
    const text = lastValidHighlight;
    lastValidHighlight = null;
    return text;
  }
  lastValidHighlight = null;
  return null;
}

export function getHighlightedSelection(): HighlightSelection {
  return { text: currentHighlight, rect: currentHighlightRect };
}

export function useHighlightedText(): string | null {
  const [text, setText] = React.useState<string | null>(currentHighlight);

  React.useEffect(() => {
    startHighlightCapture();
    const handler = (newText: string | null) => setText(newText);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  return text;
}

export function useHighlightedSelection(): HighlightSelection {
  const [selection, setSelection] = React.useState<HighlightSelection>({
    text: currentHighlight,
    rect: currentHighlightRect,
  });

  React.useEffect(() => {
    startHighlightCapture();
    const handler = (next: HighlightSelection) => setSelection(next);
    selectionListeners.add(handler);
    return () => { selectionListeners.delete(handler); };
  }, []);

  return selection;
}
