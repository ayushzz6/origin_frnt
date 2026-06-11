'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

interface TopperCard {
  initials: string;
  name: string;
  detail: string; // "AIR 234 · JEE Advanced 2025"
  quote: string;
  streakDays: number;
  accentColor: string;
  photoNote: string; // instructions for real photo
}

const TOPPERS: TopperCard[] = [
  {
    initials: 'AK',
    name: 'Aarav K.',
    detail: 'AIR 234 · JEE Advanced',
    quote: '"Origin AI explained what 3 tuition teachers couldn\'t in 2 years."',
    streakDays: 62,
    accentColor: 'from-primary/20 to-primary/5',
    photoNote: 'PHOTO · Student portrait, 200×200px, JPG — place at /images/toppers/aarav.jpg',
  },
  {
    initials: 'PS',
    name: 'Priya S.',
    detail: '99.4%ile · JEE Mains',
    quote: '"The DPP system figured out my Chemistry gaps before I even noticed them."',
    streakDays: 48,
    accentColor: 'from-emerald-500/20 to-emerald-500/5',
    photoNote: 'PHOTO · Student portrait, 200×200px, JPG — place at /images/toppers/priya.jpg',
  },
  {
    initials: 'RV',
    name: 'Rahul V.',
    detail: '720 / 720 · NEET',
    quote: '"The AI doubts solver at 2 AM before my exam saved me. No joke."',
    streakDays: 91,
    accentColor: 'from-violet-500/20 to-violet-500/5',
    photoNote: 'PHOTO · Student portrait, 200×200px, JPG — place at /images/toppers/rahul.jpg',
  },
  {
    initials: 'MS',
    name: 'Meera S.',
    detail: 'AIR 512 · JEE Advanced',
    quote: '"Went from 82nd to 97th percentile in 4 months. The analytics showed me exactly why."',
    streakDays: 38,
    accentColor: 'from-amber-500/20 to-amber-500/5',
    photoNote: 'PHOTO · Student portrait, 200×200px, JPG — place at /images/toppers/meera.jpg',
  },
  {
    initials: 'DK',
    name: 'Divya K.',
    detail: '98.7%ile · JEE Mains',
    quote: '"Study rooms changed everything. I had accountability without a physical coaching center."',
    streakDays: 55,
    accentColor: 'from-rose-500/20 to-rose-500/5',
    photoNote: 'PHOTO · Student portrait, 200×200px, JPG — place at /images/toppers/divya.jpg',
  },
];

function MiniHeatmap({ days }: { days: number }) {
  // 4 rows × 14 cols = 56 cells; first `days` cells are active
  const COLS = 14;
  const ROWS = 4;
  const cells = Array.from({ length: ROWS * COLS }, (_, i) => i < days);

  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
      {cells.map((active, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-[1px] ${active ? 'bg-primary/60' : 'bg-white/[0.06]'}`}
        />
      ))}
    </div>
  );
}

function Card({ topper }: { topper: TopperCard }) {
  return (
    <div
      className={`flex-none w-72 sm:w-80 rounded-2xl border border-white/10 bg-gradient-to-br ${topper.accentColor} backdrop-blur-sm p-6 space-y-4 select-none`}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        {/* Placeholder for real photo */}
        <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center relative overflow-hidden flex-none">
          <span className="text-base font-black text-white/70">{topper.initials}</span>
          {/* Tooltip-style photo note on hover */}
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-full p-1">
            <span className="text-[7px] text-white/70 text-center leading-tight">{topper.photoNote.slice(0, 30)}…</span>
          </div>
        </div>
        <div>
          <p className="font-black text-white text-sm">{topper.name}</p>
          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{topper.detail}</p>
        </div>
      </div>

      {/* Quote */}
      <p className="text-xs text-white/70 leading-relaxed font-medium italic">{topper.quote}</p>

      {/* Streak heatmap */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-white/30 font-semibold uppercase tracking-wider">
          <span>Streak calendar</span>
          <span>🔥 {topper.streakDays} days</span>
        </div>
        <MiniHeatmap days={topper.streakDays} />
      </div>
    </div>
  );
}

export default function TopperWall() {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  return (
    <section className="py-24 lg:py-32 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase block mb-4">Founding Batch</span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tighter mb-3">
            Built by toppers,{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">for toppers.</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium max-w-xl mx-auto">
            Our founding batch. Their real results. Drag to explore.
          </p>

          {/* Notice for user to replace placeholder data */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
              Replace with real student quotes + photos — see ADDICT.md §5
            </span>
          </div>
        </motion.div>
      </div>

      {/* Drag-scroll track */}
      <div className="overflow-hidden">
        <motion.div
          ref={trackRef}
          drag="x"
          dragConstraints={{ right: 0, left: -(TOPPERS.length * 336 - (typeof window !== 'undefined' ? window.innerWidth - 96 : 0)) }}
          dragElastic={0.1}
          style={{ x }}
          className="flex gap-5 px-6 cursor-grab active:cursor-grabbing w-max"
        >
          {TOPPERS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              viewport={{ once: true, margin: '-40px' }}
            >
              <Card topper={t} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
