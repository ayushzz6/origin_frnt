'use client';

/**
 * OriMascotStatic — canvas-free Ori avatar, now backed by the clean animated 2D art
 * (Ori2D). Used where a live WebGL canvas would be wasteful (per-message avatars, the
 * selection chip) and as the WebGL-unavailable fallback for OriMascot.
 */
import Ori2D, { type Ori2DExpression } from './Ori2D';
import type { MascotState } from './mascot-state';

export interface OriMascotStaticProps {
  className?: string;
  title?: string;
  expression?: Ori2DExpression;
  state?: MascotState;
}

export default function OriMascotStatic({ className, title = 'Origin AI', expression, state }: OriMascotStaticProps) {
  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Ori2D expression={expression} state={state} title={title} />
    </div>
  );
}
