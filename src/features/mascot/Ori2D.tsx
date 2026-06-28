'use client';

/**
 * Ori2D — lightweight, gamified 2D Ori avatar (clean transparent PNGs in /public/ori2d).
 *
 * No WebGL: just an <img> animated with Framer Motion — cheap enough to use anywhere.
 * Gives a playful pop-in entrance, a gentle continuous float, and a springy hover bounce
 * so the UI feels alive/gamified. Respects prefers-reduced-motion (static, no loop).
 *
 * Pass `expression` for a specific face, or `state` to map a chat MascotState to one.
 */
import { motion, useReducedMotion } from 'framer-motion';

import type { MascotState } from './mascot-state';

export type Ori2DExpression =
  | 'happy'
  | 'cheerful'
  | 'thumbsup'
  | 'confused'
  | 'reading'
  | 'excited'
  | 'proud'
  | 'thinking'
  | 'surprise'
  | 'determined'
  | 'laptop'
  | 'winking'
  | 'curious'
  | 'angry'
  | 'physics'
  | 'chemistry'
  | 'maths'
  | 'biology';

const FILES: Record<Ori2DExpression, string> = {
  happy: '/ori2d/ori-happy.png',
  cheerful: '/ori2d/ori-cheerful.png',
  thumbsup: '/ori2d/ori-thubmsup.png',
  confused: '/ori2d/ori-confused.png',
  reading: '/ori2d/ori-reading.png',
  excited: '/ori2d/ori-exited.png',
  proud: '/ori2d/ori-proud.png',
  thinking: '/ori2d/ori-thinking.png',
  surprise: '/ori2d/ori-surprise.png',
  determined: '/ori2d/ori-determined.png',
  laptop: '/ori2d/ori-laptop.png',
  winking: '/ori2d/ori-winking.png',
  curious: '/ori2d/ori-curious.png',
  angry: '/ori2d/ori-angry.png',
  physics: '/ori2d/ori-physics.png',
  chemistry: '/ori2d/ori-chemistry.png',
  maths: '/ori2d/ori-maths.png',
  biology: '/ori2d/ori-biology.png',
};

/** Default expression for each chat/interaction state. */
export const STATE_2D: Record<MascotState, Ori2DExpression> = {
  idle: 'happy',
  curious: 'curious',
  thinking: 'thinking',
  answering: 'cheerful',
  success: 'thumbsup',
  error: 'confused',
};

export interface Ori2DProps {
  expression?: Ori2DExpression;
  /** If given (and no `expression`), maps a chat state to an expression. */
  state?: MascotState;
  className?: string;
  title?: string;
  /** Continuous idle float. Default true. */
  float?: boolean;
}

export default function Ori2D({ expression, state, className, title = 'Origin AI', float = true }: Ori2DProps) {
  const reduce = useReducedMotion();
  const expr: Ori2DExpression = expression ?? (state ? STATE_2D[state] : 'happy');
  const src = FILES[expr];

  return (
    <motion.img
      src={src}
      alt={title}
      draggable={false}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 8 }}
      animate={
        reduce
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 1, scale: 1, y: float ? [0, -6, 0] : 0 }
      }
      transition={
        reduce
          ? { duration: 0.2 }
          : {
              opacity: { duration: 0.3 },
              scale: { type: 'spring', stiffness: 300, damping: 16 },
              y: float ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring' },
            }
      }
      whileHover={reduce ? undefined : { scale: 1.09, rotate: [0, -5, 5, -3, 0] }}
    />
  );
}
