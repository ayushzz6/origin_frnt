'use client';

/**
 * OriExpressionPop — the 2D "expression pop" overlay for the hybrid mascot.
 *
 * The GLB has no facial rig, so on each chat-state change we briefly cross-fade the matching
 * 2D Ori expression (from `Moscot-main.jpeg`) over the live 3D avatar, then fade back to 3D.
 * Sits absolutely over the canvas inside OriMascot.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { EXPRESSIONS, SHEET_SRC, STATE_EXPRESSION, tileImgStyle, type ExpressionName } from './expression-sprite';
import type { MascotState } from './mascot-state';

/** How long the expression stays up before fading back to 3D (ms). */
const HOLD_MS = 1300;

export default function OriExpressionPop({ state }: { state: MascotState }) {
  const [pop, setPop] = useState<{ id: number; expr: ExpressionName } | null>(null);
  const idRef = useRef(0);
  const prevState = useRef<MascotState | null>(null);

  useEffect(() => {
    if (prevState.current === state) return;
    prevState.current = state;

    const exprName = STATE_EXPRESSION[state];
    if (!exprName) return;

    const id = ++idRef.current;
    setPop({ id, expr: exprName });
    const timer = setTimeout(() => {
      setPop((p) => (p && p.id === id ? null : p));
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
      <AnimatePresence>
        {pop ? (
          <motion.div
            key={pop.id}
            initial={{ opacity: 0, scale: 0.55, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="absolute inset-0 overflow-hidden rounded-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SHEET_SRC} alt="" style={tileImgStyle(EXPRESSIONS[pop.expr])} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
