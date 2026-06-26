'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import LandingCTABtn from '@/components/landing/LandingCTABtn';

// JEE Main ~11 lakh candidates; AIR derived from percentile
function estimateAIR(percentile: number): number {
  return Math.max(1, Math.ceil(1_100_000 * (1 - percentile / 100)));
}

function formatAIR(air: number): string {
  if (air >= 100_000) return `${(air / 100_000).toFixed(1)}L`;
  if (air >= 1_000) return `${Math.round(air / 1_000)}K`;
  return `${air}`;
}

// Maps input params to predicted percentile — calibrated so 7h/95%/3mo → 99th
function predictPercentile(hoursPerDay: number, mockScore: number, monthsLeft: number): number {
  const h = Math.min(hoursPerDay / 12, 1);
  const s = Math.min(mockScore / 100, 1);
  const m = Math.min(monthsLeft / 18, 1);

  // Score-heavy weighting; steeper sigmoid so high performers reach 99
  const raw = 0.25 * h + 0.65 * s + 0.10 * m;
  const sigmoid = 1 / (1 + Math.exp(-15 * (raw - 0.5)));
  return Math.min(Math.round(20 + sigmoid * 80), 99);
}

// Improvement delta — "students like you moved from X to Y on Origin"
function improvementDelta(base: number): number {
  return Math.min(Math.round(3 + (100 - base) * 0.12), 15);
}

interface DialProps {
  percentile: number;
  air: number;
}

function PercentileDial({ percentile, air }: DialProps) {
  const prefersReduced = useReducedMotion();
  const cx = 100;
  const cy = 100;
  const r = 72;

  // Arc sweeps 210° (from -105° to +105° from the bottom, i.e., 225° → 315° standard notation)
  const startAngle = 215; // degrees
  const totalSweep = 290; // degrees

  function polarToXY(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(from: number, to: number, radius: number) {
    const s = polarToXY(from);
    const e = polarToXY(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const endAngle = startAngle + totalSweep;
  const filled = startAngle + (percentile / 100) * totalSweep;

  // Needle angle → tip coordinate (always finite numbers)
  const needleTarget = startAngle + (percentile / 100) * totalSweep;
  const needleTip = polarToXY(needleTarget);

  // Zone colours
  const color = percentile >= 90 ? '#10b981' : percentile >= 70 ? '#0066ff' : percentile >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg viewBox="0 0 200 130" className="w-full max-w-[260px]" aria-hidden="true">
      <defs>
        <linearGradient id="dial-fill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      {/* Background arc */}
      <path d={arcPath(startAngle, endAngle, r)} fill="none" className="stroke-black/10 dark:stroke-white/[0.08]" strokeWidth="10" strokeLinecap="round" />
      {/* Filled arc */}
      <path d={arcPath(startAngle, filled, r)} fill="none" stroke={`url(#dial-fill)`} strokeWidth="10" strokeLinecap="round" />
      {/* Needle — initial uses concrete numbers; animate springs to new tip on change */}
      <motion.line
        x1={cx}
        y1={cy}
        initial={{ x2: needleTip.x, y2: needleTip.y }}
        animate={prefersReduced ? { x2: needleTip.x, y2: needleTip.y } : { x2: needleTip.x, y2: needleTip.y }}
        transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 20 }}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Centre dot */}
      <circle cx={cx} cy={cy} r="5" fill={color} />
      {/* Percentile label */}
      <text x={cx} y={cy - 15} textAnchor="middle" fontSize="26" fontWeight="900" className="fill-gray-900 dark:fill-white" fontFamily="inherit">
        {percentile}
        <tspan fontSize="12" fontWeight="700">th</tspan>
      </text>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="8" fontWeight="700" className="fill-gray-500 dark:fill-white/40" fontFamily="inherit" letterSpacing="1">
        PERCENTILE
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="7.5" fontWeight="700" className="fill-gray-400 dark:fill-white/40" fontFamily="inherit" letterSpacing="0.5">
        AIR ~{formatAIR(air)}
      </text>
    </svg>
  );
}

export default function RankPredictor() {
  const [hours, setHours] = useState(7);
  const [score, setScore] = useState(95);
  const [months, setMonths] = useState(3);

  const percentile = predictPercentile(hours, score, months);
  const delta = improvementDelta(percentile);
  const improved = Math.min(percentile + delta, 99);
  const air = estimateAIR(percentile);
  const improvedAir = estimateAIR(improved);

  const zoneLabel = percentile >= 90 ? 'Elite Zone' : percentile >= 70 ? 'Strong Track' : percentile >= 50 ? 'On the Way' : 'Start Now';
  const zoneColor = percentile >= 90 ? 'text-emerald-400' : percentile >= 70 ? 'text-primary' : percentile >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <section id="rank-predictor" className="py-14 sm:py-24 lg:py-32 relative z-10">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-12"
        >
          <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase block mb-4">
            Know Your Future
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mb-4">
            <span className="text-outline">Where will you</span>{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              rank?
            </span>
          </h2>
          <p className="text-gray-400 dark:text-gray-400 text-base font-medium">
            Set your study plan. See where consistent effort with Origin AI takes you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true, margin: '-80px' }}
          className="grid md:grid-cols-2 gap-8 items-center"
        >
          {/* Sliders */}
          <div className="space-y-8 rounded-2xl neu-raised p-6 sm:p-8">
            <SliderField
              label="Study hours / day"
              value={hours}
              min={1} max={12} step={1}
              format={(v) => `${v}h`}
              onChange={setHours}
            />
            <SliderField
              label="Latest mock score"
              value={score}
              min={0} max={100} step={5}
              format={(v) => `${v}%`}
              onChange={setScore}
            />
            <SliderField
              label="Months until exam"
              value={months}
              min={1} max={18} step={1}
              format={(v) => `${v}mo`}
              onChange={setMonths}
            />
          </div>

          {/* Dial + result */}
          <div className="flex flex-col items-center gap-4">
            <PercentileDial percentile={percentile} air={air} />

            <motion.div
              key={percentile}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-2"
            >
              <p className={`text-sm font-black uppercase tracking-widest ${zoneColor}`}>{zoneLabel}</p>
              <p className="text-xs text-primary/80 dark:text-primary/70 max-w-[260px] mx-auto leading-relaxed text-center">
                If you work with this much consistency with Origin AI you will reach{' '}
                <span className="text-primary font-black">{improved}th percentile</span>
                {' '}(AIR ~<span className="text-primary font-black">{formatAIR(improvedAir)}</span>)!
              </p>
            </motion.div>

            <LandingCTABtn
              label="See the full curve"
              href="/auth/register"
              variant="sm"
              className="mt-2"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SliderField({
  label, value, min, max, step, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 dark:text-white/60 uppercase tracking-wider">{label}</span>
        <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{format(value)}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-track]]:bg-gray-200 dark:[&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-thumb]]:border-primary"
      />
    </div>
  );
}
