'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useMainScrollContainer } from '@/hooks/useMainScrollContainer';

const OriginLogoBackground = dynamic(() => import('@/components/ui/OriginLogoBackground'), { ssr: false });

const WORDS = ['Toppers', "aren't", 'born.', 'They', 'have', 'an', 'Origin.'];

// Sub-component owns its hooks — satisfies React Rules of Hooks (no hooks in .map callbacks)
function WordReveal({ word, i, total, scrollYProgress, prefersReduced }: {
  word: string; i: number; total: number;
  scrollYProgress: MotionValue<number>; prefersReduced: boolean;
}) {
  const REVEAL_WITHIN = 0.6;
  const start = (i / total) * REVEAL_WITHIN;
  const mid = start + (0.5 / total) * REVEAL_WITHIN;
  const opacity = useTransform(scrollYProgress, [start, mid], [0.12, 1]);
  const y = useTransform(scrollYProgress, [start, mid], [20, 0]);
  const isHighlight = word === 'Origin.';
  return (
    <motion.span
      style={prefersReduced ? undefined : { opacity, y }}
      className={`text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-none ${
        isHighlight
          ? 'bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent'
          : 'text-white'
      }`}
    >
      {word}
    </motion.span>
  );
}

export default function ManifestoReveal({ onBeginJourney }: { onBeginJourney?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainer = useMainScrollContainer();
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    container: scrollContainer,
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-32 z-10"
      style={{ background: 'linear-gradient(to bottom, transparent, rgba(2,6,23,0.97) 20%, rgb(2,6,23) 50%, rgb(2,6,23) 80%, transparent)' }}
    >
      {/* 3D logo at 8% opacity behind */}
      <div className="absolute inset-0 z-0 opacity-[0.08] pointer-events-none">
        <OriginLogoBackground />
      </div>

      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(0,102,255,0.12),transparent)] pointer-events-none z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Word-by-word reveal — all words complete by ~28% progress (≈ section top at 40% from viewport top) */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-16">
          {WORDS.map((word, i) => (
            <WordReveal
              key={i}
              word={word}
              i={i}
              total={WORDS.length}
              scrollYProgress={scrollYProgress}
              prefersReduced={!!prefersReduced}
            />
          ))}
        </div>

        {/* CTA */}
        <motion.button
          onClick={onBeginJourney}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          viewport={{ once: true, margin: '-60px' }}
          whileHover={{ scale: 1.05, y: -3 }}
          whileTap={{ scale: 0.97 }}
          data-cursor="cta"
          className="relative group overflow-hidden rounded-full cursor-pointer mx-auto block"
        >
          <span className="absolute inset-0 rounded-full bg-primary/40 blur-2xl scale-110 opacity-0 group-hover:opacity-100 transition-all duration-500" />
          <span className="absolute inset-0 rounded-full overflow-hidden">
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </span>
          <span className="relative flex items-center px-14 py-5 rounded-full bg-primary text-white text-base font-black uppercase tracking-widest shadow-[0_0_60px_rgba(0,102,255,0.6)] border border-white/20">
            Start your Origin
          </span>
        </motion.button>
      </div>
    </section>
  );
}
