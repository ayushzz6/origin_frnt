'use client';

import { Suspense, lazy, useEffect, useRef } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // The robot canvas usually sits BEHIND page content (z-0), so the content layers
  // intercept the cursor before it reaches the canvas and Spline never sees it.
  // Forward the real cursor position to the canvas as synthetic pointer events so the
  // robot stays mouse-sensitive no matter what is layered on top of it.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let canvas: HTMLCanvasElement | null = null;
    // Guards against the synthetic events we dispatch bubbling back to this
    // same window listener and re-triggering it — that feedback loop (plus the
    // double event when hovering the canvas directly) is what made the robot flicker.
    let forwarding = false;

    const forward = (e: PointerEvent) => {
      if (forwarding) return;
      if (!canvas || !canvas.isConnected) canvas = root.querySelector('canvas');
      if (!canvas) return;
      // When the cursor is already directly over the canvas it receives the real
      // pointer event natively; forwarding a second synthetic one makes it jitter.
      if (e.target === canvas) return;
      const init: PointerEventInit = {
        clientX: e.clientX,
        clientY: e.clientY,
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse',
        pointerId: 1,
        isPrimary: true,
      };
      forwarding = true;
      canvas.dispatchEvent(new PointerEvent('pointermove', init));
      canvas.dispatchEvent(new MouseEvent('mousemove', init));
      forwarding = false;
    };

    window.addEventListener('pointermove', forward, { passive: true });
    return () => window.removeEventListener('pointermove', forward);
  }, []);

  return (
    <div ref={rootRef} className={className}>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        }
      >
        <Spline scene={scene} className="!w-full !h-full" />
      </Suspense>
    </div>
  );
}
