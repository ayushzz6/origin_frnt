'use client';

import { useRef, type RefObject } from 'react';

/**
 * Returns a ref to the app's real scroll container — ClientShell's `<main>`
 * (`overflow-y-auto`). The window never scrolls in this app, so Framer Motion
 * `useScroll({ container })` must point here for scroll-linked animations to
 * track correctly. Populated synchronously on the client before Framer's
 * internal scroll effect runs.
 */
export function useMainScrollContainer(): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  if (typeof document !== 'undefined' && !ref.current) {
    ref.current = document.querySelector('main');
  }
  return ref;
}
