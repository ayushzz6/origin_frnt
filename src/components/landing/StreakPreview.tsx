'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, AnimatePresence } from 'framer-motion';

const MAX_STREAK = 47;
const XP_TARGET = 78; // % fill

// Mini confetti burst (pure canvas, no library needed)
function ConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number }[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#0066ff', '#10b981', '#f59e0b', '#ec4899', '#ffffff'];
    particles.current = Array.from({ length: 80 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 5 + 2,
      alpha: 1,
    }));

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles.current) {
        p.vy += 0.4;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.018;
        if (p.alpha > 0) {
          alive = true;
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
      ctx.globalAlpha = 1;
      if (alive) rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={200}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

function HeatmapCell({ active, delay }: { active: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: active ? 1 : 0.08, scale: 1 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className={`w-3 h-3 rounded-sm ${active ? 'bg-primary' : 'bg-white/10'}`}
    />
  );
}

export default function StreakPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const prefersReduced = useReducedMotion();

  const [streak, setStreak] = useState(1);
  const [xp, setXp] = useState(0);
  const [levelUp, setLevelUp] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!inView || prefersReduced) {
      if (prefersReduced) { setStreak(MAX_STREAK); setXp(XP_TARGET); }
      return;
    }

    // Animate streak counter 1 → MAX_STREAK over ~2.5s
    const duration = 2500;
    const start = Date.now();
    let raf: number;

    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setStreak(Math.round(1 + eased * (MAX_STREAK - 1)));
      setXp(Math.round(eased * XP_TARGET));

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setLevelUp(true);
        setTimeout(() => setConfetti(true), 300);
        setTimeout(() => { setConfetti(false); setLevelUp(false); }, 2500);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, prefersReduced]);

  // Heatmap: 7 rows × 20 cols; cells are "active" based on streak day index
  const heatmapCells = Array.from({ length: 7 * 20 }, (_, i) => i < MAX_STREAK);

  return (
    <section className="py-24 lg:py-32 relative z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_80%,rgba(0,102,255,0.06),transparent)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tighter">
            Day 48 is{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              waiting for you.
            </span>
          </h2>
        </motion.div>

        <div ref={ref} className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left: flame + XP card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative rounded-2xl border border-white/10 bg-white/5 dark:bg-white/[0.03] backdrop-blur-xl p-8 overflow-hidden"
          >
            <ConfettiBurst active={confetti} />

            {/* Flame + counter */}
            <div className="flex items-center gap-4 mb-6">
              <motion.div
                animate={inView && !prefersReduced ? { scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] } : {}}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="text-5xl select-none"
              >
                🔥
              </motion.div>
              <div>
                <div className="text-6xl font-black text-white tabular-nums leading-none">{streak}</div>
                <div className="text-xs text-white/40 font-semibold uppercase tracking-widest mt-1">Day Streak</div>
              </div>
            </div>

            {/* XP Bar */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between text-xs font-black text-white/60 uppercase tracking-wider">
                <span>XP Progress</span>
                <span>{xp}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                  style={{ width: `${xp}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/30 font-medium">
                <span>Level 7</span>
                <span>Level 8</span>
              </div>
            </div>

            {/* Level up badge */}
            <AnimatePresence>
              {levelUp && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.8 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 w-fit"
                >
                  <span className="text-base">⚡</span>
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Level Up!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right: streak heatmap */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <p className="text-xs font-black text-white/40 uppercase tracking-widest">Your study calendar</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(20, 1fr)', gridTemplateRows: 'repeat(7, 1fr)' }}>
              {heatmapCells.map((active, i) => (
                <HeatmapCell key={i} active={active && inView} delay={inView ? (i % 20) * 0.02 : 0} />
              ))}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/30 font-medium">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-white/10 inline-block" /> Less</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary/40 inline-block" /></span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> More</span>
            </div>
            <p className="text-sm text-white/50 font-medium leading-relaxed">
              Students who maintain a 30-day streak see an average <span className="text-white font-black">+12 percentile</span> gain. What does your calendar look like?
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
