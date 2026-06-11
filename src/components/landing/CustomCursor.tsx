'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function CustomCursor() {
  const prefersReduced = useReducedMotion();
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [ring, setRing] = useState({ x: -100, y: -100 });
  const [isCta, setIsCta] = useState(false);
  const [visible, setVisible] = useState(false);
  const ringRef = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Only on desktop — hide on touch devices
    if (prefersReduced || window.matchMedia('(hover: none)').matches) return;

    function onMove(e: MouseEvent) {
      setPos({ x: e.clientX, y: e.clientY });
      if (!visible) setVisible(true);

      const target = e.target as HTMLElement;
      setIsCta(
        !!target.closest('[data-cursor="cta"]') ||
        !!target.closest('button') ||
        !!target.closest('a')
      );
    }

    function onLeave() { setVisible(false); }
    function onEnter() { setVisible(true); }

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    // Trailing ring via RAF lerp
    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
    function loop() {
      ringRef.current.x = lerp(ringRef.current.x, pos.x, 0.12);
      ringRef.current.y = lerp(ringRef.current.y, pos.y, 0.12);
      setRing({ ...ringRef.current });
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReduced]);

  if (prefersReduced) return null;

  return (
    <>
      {/* Dot */}
      <div
        className="fixed pointer-events-none z-[9999] rounded-full bg-primary"
        style={{
          width: 6,
          height: 6,
          left: pos.x - 3,
          top: pos.y - 3,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s',
          mixBlendMode: 'difference',
        }}
      />
      {/* Trailing ring */}
      <motion.div
        className="fixed pointer-events-none z-[9998] rounded-full border border-primary/60"
        style={{
          left: ring.x,
          top: ring.y,
          opacity: visible ? 0.7 : 0,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          width: isCta ? 56 : 28,
          height: isCta ? 56 : 28,
          borderColor: isCta ? 'rgba(0,102,255,0.9)' : 'rgba(0,102,255,0.6)',
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
    </>
  );
}
