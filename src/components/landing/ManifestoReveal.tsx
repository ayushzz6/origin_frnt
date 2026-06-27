'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';
import { useMainScrollContainer } from '@/hooks/useMainScrollContainer';
import LandingCTABtn from '@/components/landing/LandingCTABtn';

const WORDS = ['Toppers', "aren't", 'born.', 'They', 'have', 'an', 'Origin.'];

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
      className={`text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-none ${isHighlight
          ? 'bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent'
          : 'text-outline'
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
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-16 sm:py-32 z-10"
    >
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
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

        <LandingCTABtn
          label="Start your Origin"
          onClick={onBeginJourney}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          viewport={{ once: true, margin: '-60px' } as React.ComponentProps<typeof motion.button>['viewport']}
        />
      </div>
    </section>
  );
}
