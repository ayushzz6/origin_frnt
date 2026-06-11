'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const PHRASES = [
  'Your AI mentor never sleeps.',
  'Rank prediction, 180 days early.',
  'The Origin of Toppers.',
];

const TYPE_SPEED = 40; // ms per char
const HOLD_MS = 2500;
const DELETE_SPEED = 20; // ms per char

export function useTypewriter(phrases = PHRASES) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(prefersReduced ? phrases[0] : '');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('typing');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(phrases[phraseIdx % phrases.length]);
      return;
    }

    const current = phrases[phraseIdx % phrases.length];

    if (phase === 'typing') {
      if (display.length < current.length) {
        timeoutRef.current = setTimeout(() => {
          setDisplay(current.slice(0, display.length + 1));
        }, TYPE_SPEED);
      } else {
        timeoutRef.current = setTimeout(() => setPhase('holding'), HOLD_MS);
      }
    } else if (phase === 'holding') {
      timeoutRef.current = setTimeout(() => setPhase('deleting'), 100);
    } else if (phase === 'deleting') {
      if (display.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setDisplay(display.slice(0, -1));
        }, DELETE_SPEED);
      } else {
        setPhraseIdx((i) => i + 1);
        setPhase('typing');
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [display, phase, phraseIdx, phrases, prefersReduced]);

  return { text: display, isTyping: phase === 'typing' };
}
