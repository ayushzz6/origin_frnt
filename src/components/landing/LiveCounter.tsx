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
  if (!value.match(/\d/)) return <span>{value}</span>;

  return (
    <span className="inline-block overflow-hidden relative" style={{ height: '1.1em', width: '0.65em' }}>
      <motion.span
        key={value}
        initial={prefersReduced ? false : { y: '-100%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 flex items-center justify-center"
      >
        {value}
      </motion.span>
    </span>
  );
}

function OdometerNumber({ value }: { value: number }) {
  const formatted = value.toLocaleString('en-IN');
  return (
    <span className="font-mono tabular-nums">
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
      className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-8"
    >
      {/* Active now */}
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <OdometerNumber value={stats.activeNow} />
        <span className="text-white/50 font-normal">solving right now</span>
      </div>

      <div className="w-px h-4 bg-white/20 hidden sm:block" />

      {/* Doubts today */}
      <div className="text-sm font-semibold text-white/80">
        <OdometerNumber value={stats.doubtsToday} />
        <span className="text-white/50 font-normal ml-1.5">doubts solved today</span>
      </div>

      <div className="w-px h-4 bg-white/20 hidden sm:block" />

      {/* Active streaks */}
      <div className="text-sm font-semibold text-white/80">
        🔥 <OdometerNumber value={stats.streaksActive} />
        <span className="text-white/50 font-normal ml-1.5">active streaks</span>
      </div>
    </motion.div>
  );
}
