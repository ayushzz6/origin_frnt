'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface LiveStats {
  activeNow: number;
  doubtsToday: number;
  streaksActive: number;
}

function OdometerDigit({ value }: { value: string }) {
  const prefersReduced = useReducedMotion();
  if (!value.match(/\d/)) return <span className="align-middle">{value}</span>;

  return (
    <span className="inline-flex items-center justify-center overflow-hidden relative w-[0.6em] h-[1.2em] align-middle">
      <motion.span
        key={value}
        initial={prefersReduced ? false : { y: '-100%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 flex items-center justify-center font-mono tabular-nums leading-none"
      >
        {value}
      </motion.span>
    </span>
  );
}

function OdometerNumber({ value }: { value: number }) {
  const formatted = value.toLocaleString('en-IN');
  return (
    <span className="font-mono tabular-nums inline-flex items-center align-middle">
      {formatted.split('').map((ch, i) => (
        <OdometerDigit key={i} value={ch} />
      ))}
    </span>
  );
}

export default function LiveCounter() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  async function fetchStats() {
    try {
      const res = await fetch('/api/public/live-stats', { cache: 'no-store' });
      if (res.ok) setStats(await res.json());
    } catch {
      // silently degrade
    }
  }

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(() => {
      // Client-side jitter so the number visibly breathes without hitting the server every 5s
      setStats((prev) => {
        if (!prev) return prev;
        const delta = (n: number) => n + Math.floor((Math.random() - 0.5) * 6);
        return { ...prev, activeNow: delta(prev.activeNow) };
      });
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.9 }}
      className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 neu-inset px-6 py-3.5 rounded-full border border-white/10 dark:border-black/5"
    >
      {/* Active now */}
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 leading-none">
        <span className="relative flex h-2 w-2 shrink-0 self-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-heading font-black text-foreground">
            <OdometerNumber value={stats.activeNow} />
          </span>
          <span className="text-muted-foreground font-medium text-xs">solving right now</span>
        </div>
      </div>

      <div className="w-px h-4 bg-muted-foreground/30 hidden sm:block self-center" />

      {/* Doubts today */}
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80 leading-none">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-heading font-black text-foreground">
            <OdometerNumber value={stats.doubtsToday} />
          </span>
          <span className="text-muted-foreground font-medium text-xs">doubts solved today</span>
        </div>
      </div>

      <div className="w-px h-4 bg-muted-foreground/30 hidden sm:block self-center" />

      {/* Active streaks */}
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80 leading-none">
        <span className="text-sm self-center">🔥</span>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-heading font-black text-foreground">
            <OdometerNumber value={stats.streaksActive} />
          </span>
          <span className="text-muted-foreground font-medium text-xs">active streaks</span>
        </div>
      </div>
    </motion.div>
  );
}
