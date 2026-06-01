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
// When the browser clears the selection (e.g. clicking a button), we keep the
// last valid highlight for a short window so auto-ask flows can still read it.
let lastValidHighlight: string | null = null;
let lastValidHighlightTs: number = 0;
const HIGHLIGHT_RETAIN_MS = 3_000; // keep for 3 seconds after deselection
const listeners = new Set<Listener>();
const selectionListeners = new Set<SelectionListener>();

// Selection state tracking
let isMouseDown = false;
let heavyExtractionTimeout: NodeJS.Timeout | null = null;

function emitChange() {
  listeners.forEach((listener) => listener(currentHighlight));
  const selection = {
    text: currentHighlight,
    rect: currentHighlightRect,
  };
  selectionListeners.forEach((listener) => listener(selection));
}

function getSelectionRect(selection: Selection | null): HighlightRect | null {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function extractSelectionText(selection: Selection | null): string | null {
  if (!selection || selection.rangeCount === 0) return null;

  // If we are currently dragging, we perform a LIGHTWEIGHT extraction to avoid
  // triggering layout recalcs that disrupt the browser's selection engine.
  if (isMouseDown) {
    return selection.toString().trim() || null;
  }

  let extractedText = '';
  
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const frag = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);

    // Process KaTeX nodes bottom-up to handle nested math correctly
    const katexNodes = Array.from(div.querySelectorAll('.katex'));
    // Sort by depth (deepest first) to ensure we don't replace a parent before its children
    katexNodes.sort((a, b) => b.querySelectorAll('*').length - a.querySelectorAll('*').length);

    katexNodes.forEach((node) => {
      // Check if node is still connected to our working div
      if (!div.contains(node)) return;

      const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
      const mathElement = node.querySelector('math');
      const ariaLabel = node.getAttribute('aria-label');
      
      // Attempt to find the best LaTeX source
      const tex = (annotation?.textContent || mathElement?.getAttribute('alttext') || ariaLabel || '').trim();
      
      // If the TeX source looks like it might be visual junk (contains symbols like √ or scripts incorrectly)
      // we try to clean it or skip it to avoid corruption like "$./$(...)"
      if (tex && !tex.includes('$./')) {
        const isDisplay = node.classList.contains('katex-display') || !!node.querySelector('.katex-display');
        const delimiter = isDisplay ? '$$' : '$';
        
        // Replace the entire KaTeX block with the clean TeX string
        const textNode = document.createTextNode(`${delimiter}${tex}${delimiter}`);
        node.replaceWith(textNode);
      } else {
        // If no reliable TeX found, strip all visual noise to prevent corrupted innerText
        node.querySelectorAll('.katex-html, .katex-mathml').forEach(n => n.remove());
        // If it's a root .katex node and we cleared its guts, remove it entirely
        if (node.classList.contains('katex') && !node.textContent?.trim()) {
          node.remove();
        }
      }
    });

    // Cleanup orphaned KaTeX fragments (common in partial selections)
    const orphanedJunk = div.querySelectorAll(
      '.katex-html, .katex-mathml, .katex-display, .vlist, .strut, .base, .mord, .msupsub'
    );
    orphanedJunk.forEach(n => n.remove());

    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    document.body.appendChild(div);
    
    // innerText respects display:none and gives us a clean text representation
    extractedText += div.innerText;
    document.body.removeChild(div);
  }
  
  return wrapUnwrappedMath(extractedText.trim()) || null;
}

/**
 * Heuristic to wrap common LaTeX-like patterns in $ delimiters if they aren't already.
 * This handles raw text selections from textareas or restricted PDF text layers.
 */
export function wrapUnwrappedMath(text: string): string {
  if (!text) return text;
  
  // Only apply if the text doesn't already have $ delimiters (simple heuristic)
  if (text.includes('$')) return text;

  // Common LaTeX commands and patterns that strongly imply math
  const mathCommands = [
    '\\\\frac', '\\\\sqrt', '\\\\sum', '\\\\int', '\\\\alpha', '\\\\beta', '\\\\gamma',
    '\\\\delta', '\\\\theta', '\\\\lambda', '\\\\pi', '\\\\sigma', '\\\\omega',
    '\\\\infty', '\\\\partial', '\\\\nabla', '\\\\times', '\\\\div', '\\\\pm',
    '\\\\le', '\\\\ge', '\\\\ne', '\\\\approx', '\\\\equiv', '\\\\forall', '\\\\exists',
    '\\\\cos', '\\\\sin', '\\\\tan', '\\\\log', '\\\\ln'
  ];

  // Specific patterns like cos^-1, i+j, A=B+C, x^2
  const mathPatterns = [
    /[a-zA-Z0-9]\^[0-9\-+]/,         // superscripts: x^2, e^-1
    /[a-zA-Z0-9]_[0-9]/,            // subscripts: x_1
    /[ijk]\s*[+-]\s*[ijk]/,         // vectors: i+j, j+k
    /[a-zA-Z]\s*=\s*[a-zA-Z0-9+-]/,  // assignments: A=B+C
    /(sin|cos|tan)\^?-?[0-9]?/      // trig functions: cos^-1, sinx
  ];

  const cmdRegex = new RegExp(`(${mathCommands.join('|')})`, 'i');
  const hasMathCommand = cmdRegex.test(text);
  const hasMathPattern = mathPatterns.some(pattern => pattern.test(text));
  
  if (hasMathCommand || hasMathPattern) {
    // If the text has a lot of spaces and doesn't look like pure math, 
    // it's likely a paragraph mixed with math. We shouldn't wrap the whole thing.
    // Let the AI or the markdown parser handle the inner math.
    const spaceCount = (text.match(/ /g) || []).length;
    if (spaceCount > 5 || text.length > 100) {
       return text; // It's a paragraph, don't wrap the whole thing.
    }
    
    // If it's a multi-line block or very long, use $$
    if (text.includes('\n')) {
      return `$$\n${text}\n$$`;
    }
    return `$${text}$`;
  }

  return text;
}

function handleSelectionChange() {
  const selection = window.getSelection();
  
  // Phase 1: Immediate lightweight update
  const lightText = selection?.toString().trim() || null;
  
  if (!lightText) {
    // DO NOT clear currentHighlight here when the selection becomes empty.
    // Taps outside the selection/origin area will be handled by handleGlobalClick.
    return;
  }

  // Check if we are inside an ignored root
  const anchorNode = selection?.anchorNode;
  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;
  if (anchorElement?.closest('[data-origin-ai-root="true"]')) {
    clearHighlightedText();
    return;
  }

  // Update immediately with light text if it's new (Phase 1)
  // This gives the user feedback that selection is working without causing lag.
  if (lightText !== currentHighlight) {
    currentHighlight = lightText;
    currentHighlightRect = getSelectionRect(selection);
    
    // Update CSS Highlight API
    if (typeof CSS !== 'undefined' && (CSS as any).highlights && typeof window !== 'undefined' && (window as any).Highlight && selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0).cloneRange();
        const highlight = new (window as any).Highlight(range);
        (CSS as any).highlights.set("origin-ai-selection", highlight);
      } catch (e) {
        console.error("Failed to set CSS highlight", e);
      }
    }
    
    emitChange();
  }

  // Phase 2: Rich extraction (KaTeX handling)
  // We debounce this to avoid DOM mutations during active dragging.
  if (heavyExtractionTimeout) clearTimeout(heavyExtractionTimeout);
  
  heavyExtractionTimeout = setTimeout(() => {
    // Only perform rich extraction if we still have a selection and mouse is up
    if (!isMouseDown) {
      const richSelection = window.getSelection();
      const richText = extractSelectionText(richSelection);
      if (richText && richText !== currentHighlight) {
        currentHighlight = richText;
        currentHighlightRect = getSelectionRect(richSelection);
        
        // Update CSS Highlight API with rich range
        if (typeof CSS !== 'undefined' && (CSS as any).highlights && typeof window !== 'undefined' && (window as any).Highlight && richSelection && richSelection.rangeCount > 0) {
          try {
            const range = richSelection.getRangeAt(0).cloneRange();
            const highlight = new (window as any).Highlight(range);
            (CSS as any).highlights.set("origin-ai-selection", highlight);
          } catch (e) {
            console.error("Failed to set CSS highlight", e);
          }
        }
        
        emitChange();
      }
    }
  }, 200);
}

// Global mouse listeners to track drag state
function handleMouseDown() { 
  isMouseDown = true; 
}
function handleMouseUp() { 
  isMouseDown = false;
  // Trigger a re-evaluation on mouse up to finalize the rich extraction
  handleSelectionChange();
}

function handleGlobalClick(event: MouseEvent) {
  const target = event.target as Element | null;
  
  // If clicked inside the origin area, do not clear
  if (target?.closest('[data-origin-ai-root="true"]')) {
    return;
  }

  // Check if browser currently has a selection (during mouse click release)
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || "";

  // If there is no selection, clear the highlight
  if (!selectedText) {
    clearHighlightedText();
  }
}

let isListening = false;

export function startHighlightCapture(): void {
  if (typeof window === 'undefined' || isListening) return;
  isListening = true;
  document.addEventListener('selectionchange', handleSelectionChange);
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('click', handleGlobalClick);
}

export function stopHighlightCapture(): void {
  if (typeof window === 'undefined') return;
  isListening = false;
  document.removeEventListener('selectionchange', handleSelectionChange);
  window.removeEventListener('mousedown', handleMouseDown);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('click', handleGlobalClick);
  clearHighlightedText();
}

export function clearHighlightedText(): void {
  currentHighlight = null;
  currentHighlightRect = null;
  if (typeof CSS !== 'undefined' && (CSS as any).highlights) {
    try {
      (CSS as any).highlights.delete("origin-ai-selection");
    } catch (_) {}
  }
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

/**
 * Snapshot the current highlighted text so it survives the browser clearing
 * the selection. Also copies to lastValidHighlight as a fallback.
 */
export function snapshotHighlightedText(): void {
  if (currentHighlight) {
    lastValidHighlight = currentHighlight;
    lastValidHighlightTs = Date.now();
  }
}

/**
 * Retrieve the highlighted text, falling back to the last valid highlight
 * if the browser already cleared the selection (within a 3-second window).
 * Consumes the buffer on read to prevent stale reuse.
 */
export function getPendingHighlightedText(): string | null {
  // Prefer current live highlight
  if (currentHighlight) {
    return currentHighlight;
  }
  // Fall back to the time-buffered last valid highlight
  if (lastValidHighlight && (Date.now() - lastValidHighlightTs) < HIGHLIGHT_RETAIN_MS) {
    const text = lastValidHighlight;
    lastValidHighlight = null; // consume
    return text;
  }
  lastValidHighlight = null;
  return null;
}

export function getHighlightedSelection(): HighlightSelection {
  return {
    text: currentHighlight,
    rect: currentHighlightRect,
  };
}

export function useHighlightedText(): string | null {
  const [text, setText] = React.useState<string | null>(currentHighlight);

  React.useEffect(() => {
    startHighlightCapture();

    const handler = (newText: string | null) => {
      setText(newText);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
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

    const handler = (nextSelection: HighlightSelection) => {
      setSelection(nextSelection);
    };

    selectionListeners.add(handler);
    return () => {
      selectionListeners.delete(handler);
    };
  }, []);

  return selection;
}
