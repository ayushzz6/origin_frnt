'use client';

interface SmoothScrollProps {
  children: React.ReactNode;
}

/**
 * Smooth-scroll wrapper — currently a transparent passthrough (native scroll).
 *
 * WHY LENIS IS DISABLED:
 * This app does not scroll the window. The shell is `h-dvh overflow-hidden`
 * and the real scroll happens inside ClientShell's `<main>` (`overflow-y-auto`).
 * The landing page also contains a pinned `ScrollStack` section (~10,650px tall)
 * that reads `main.scrollTop` and applies transform-based card stacking.
 *
 * Driving that custom container with Lenis was verified (headless Chromium) to
 * STALL scrolling mid-page: Lenis's content-height measurement is thrown off by
 * ScrollStack's live scale/translate transforms, so it clamps the scroll target
 * and freezes around the ScrollStack region. Native scroll reaches the bottom
 * cleanly (25,651px) every time. Reliable scrolling > smooth-scroll polish.
 *
 * The scroll-linked animations (StickyFeatureCinema, ManifestoReveal) already
 * use `useScroll({ container })` pointed at the inner <main>, so they track
 * native scroll correctly without Lenis. Kept as a wrapper so a
 * ScrollStack-compatible smooth-scroll solution can be slotted in later.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  return <>{children}</>;
}
