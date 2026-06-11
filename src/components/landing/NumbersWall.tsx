'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

interface Digit {
  val: string;
  key: number; // incremented each render to trigger re-animation
}

function OdometerDigit({ char, index }: { char: string; index: number }) {
  const prefersReduced = useReducedMotion();
  if (!/\d/.test(char)) return <span className="inline-block">{char}</span>;

  const digits = ['0','1','2','3','4','5','6','7','8','9'];
  const targetIdx = digits.indexOf(char);

  return (
    <span className="inline-block overflow-hidden relative" style={{ height: '1em', lineHeight: '1em' }}>
      <motion.span
        className="flex flex-col"
        initial={prefersReduced ? false : { y: 0 }}
        animate={{ y: `-${targetIdx * 10}%` }}
        transition={{ duration: 1.2 + index * 0.08, ease: [0.16, 1, 0.3, 1], delay: 0.1 * index }}
        style={{ display: 'flex', flexDirection: 'column', height: `${digits.length * 100}%` }}
      >
        {digits.map((d) => (
          <span key={d} className="block" style={{ height: `${100 / digits.length}%`, lineHeight: '1em' }}>
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function OdometerNumber({ value, suffix = '' }: { value: string; suffix?: string }) {
  const chars = value.split('');
  return (
    <span className="inline-flex items-baseline">
      {chars.map((ch, i) => (
        <OdometerDigit key={i} char={ch} index={i} />
      ))}
      {suffix && <span className="ml-1">{suffix}</span>}
    </span>
  );
}

interface Stat {
  value: string;
  suffix: string;
  label: string;
  sublabel: string;
  accent: string;
}

const STATS: Stat[] = [
  {
    value: '12620',
    suffix: '+',
    label: 'Questions in Bank',
    sublabel: 'NCERT · PYQs · Irodov · HC Verma · Exemplar',
    accent: 'from-primary/20 to-primary/5',
  },
  {
    value: '24000',
    suffix: '+',
    label: 'Doubts Resolved',
    sublabel: 'By Origin AI, 24 / 7, across all subjects',
    accent: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    value: '12',
    suffix: '%ile',
    label: 'Avg Percentile Gain',
    sublabel: 'For students who complete 30-day DPP cycles',
    accent: 'from-violet-500/20 to-violet-500/5',
  },
  {
    value: '3210',
    suffix: '',
    label: 'Active Streaks Today',
    sublabel: 'Students studying every single day',
    accent: 'from-amber-500/20 to-amber-500/5',
  },
];

export default function NumbersWall() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 lg:py-32 relative z-10 overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(0,102,255,0.07),transparent)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-16"
        >
          <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase block mb-4">By the Numbers</span>
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter">
            <span className="text-outline">The</span>{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              proof
            </span>{' '}
            <span className="text-outline">is in the data.</span>
          </h2>
        </motion.div>

        {/* Desktop 2×2 grid, mobile 1-col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              viewport={{ once: true, margin: '-60px' }}
              className={`relative rounded-2xl border border-black/10 dark:border-white/10 bg-gradient-to-br ${stat.accent} backdrop-blur-sm p-8 overflow-hidden group`}
            >
              {/* Hover shimmer */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

              <div className="text-6xl sm:text-7xl lg:text-8xl font-black text-outline tracking-tighter leading-none mb-3 tabular-nums font-heading">
                {inView ? <OdometerNumber value={stat.value} suffix={stat.suffix} /> : <span>{stat.value}{stat.suffix}</span>}
              </div>
              <p className="text-base sm:text-lg font-black text-outline mb-1 tracking-tight">{stat.label}</p>
              <p className="text-xs text-gray-500 dark:text-white/40 font-medium">{stat.sublabel}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
