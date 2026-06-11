'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';
import { useMainScrollContainer } from '@/hooks/useMainScrollContainer';

interface CinemaFeature {
  eyebrow: string;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
  video: string | null;
  videoNote: string; // shown when video is null or as caption
  accent: string;
}

const FEATURES: CinemaFeature[] = [
  {
    eyebrow: 'AI Mentor',
    title: 'Ask anything.\nIt remembers\neverything.',
    description:
      "Origin AI knows your history — every doubt you've asked, every concept you've struggled with. It doesn't just answer; it builds on what you already know.",
    stat: '24,000+',
    statLabel: 'doubts resolved this month',
    video: '/videos/Instant-Doubt-Resolution.mp4',
    videoNote: 'VIDEO · 8 sec · Doubt Solver in action — student highlights text, AI responds with step-by-step solution',
    accent: 'rgba(0,102,255,0.15)',
  },
  {
    eyebrow: 'Daily Practice',
    title: 'Every day\ncounts. Make\nthem count.',
    description:
      'Adaptive DPPs that zero in on your exact weak points. Each problem set is different — because you are different from yesterday.',
    stat: '847',
    statLabel: 'DPPs completed today',
    video: '/videos/Gamified-Growth.mp4',
    videoNote: 'VIDEO · 8 sec · DPP dashboard — daily streak tracker with flame animation, new problems unlocking',
    accent: 'rgba(16,185,129,0.12)',
  },
  {
    eyebrow: 'Predictive Analytics',
    title: 'Know your\nrank before\nthe exam does.',
    description:
      "Real-time percentile tracking, velocity scores, accuracy curves — across every topic. See exactly where you are and where you're headed.",
    stat: '+12%ile',
    statLabel: 'avg gain after 30-day cycle',
    video: null,
    videoNote: 'IMAGE · Analytics dashboard screenshot — percentile curve, accuracy heatmap, topic breakdown chart (1600×900 PNG)',
    accent: 'rgba(139,92,246,0.12)',
  },
  {
    eyebrow: 'Study Rooms',
    title: 'Never study\nalone again.',
    description:
      "Live study rooms with real-time presence. See who's online, start a focused session, share doubts — without leaving your workspace.",
    stat: '340',
    statLabel: 'rooms active right now',
    video: null,
    videoNote: 'VIDEO · 10 sec · Study room — multiple cursors visible, live participant list, shared Pomodoro timer',
    accent: 'rgba(245,158,11,0.10)',
  },
];

// Sub-components own their hooks — this satisfies React Rules of Hooks (no hooks in .map callbacks)
function TextSlide({ feature, index, total, scrollYProgress, prefersReduced }: {
  feature: CinemaFeature; index: number; total: number;
  scrollYProgress: MotionValue<number>; prefersReduced: boolean;
}) {
  const start = index / total;
  const end = (index + 1) / total;
  const offsets: [number, number, number, number] = [
    Math.max(0, start - 0.05),
    Math.min(1, start + 0.1),
    Math.max(0, end - 0.1),
    Math.min(1, end + 0.05),
  ];
  const opacity = useTransform(scrollYProgress, offsets, [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, offsets, [40, 0, 0, -40]);
  return (
    <motion.div
      style={prefersReduced ? undefined : { opacity, y, position: 'absolute', width: '100%' }}
      className={prefersReduced ? (index === 0 ? 'block' : 'hidden') : 'absolute w-full'}
    >
      <FeatureText feature={feature} large />
    </motion.div>
  );
}


export default function StickyFeatureCinema() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainer = useMainScrollContainer();
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    container: scrollContainer,
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  return (
    <section className="py-24 lg:py-32 relative z-10 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-6">
        {/* On desktop: sticky left + right video. On mobile: stacked cards */}

        {/* Mobile — stacked */}
        <div className="flex flex-col gap-16 lg:hidden">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true, margin: '-60px' }}
            >
              <FeatureText feature={feat} />
            </motion.div>
          ))}
        </div>

        {/* Desktop — sticky scroll, text centred full-width */}
        <div ref={containerRef} className="hidden lg:block relative" style={{ height: `${FEATURES.length * 100}vh` }}>
          <div className="sticky top-0 h-screen flex items-center justify-center">
            <div className="relative w-full max-w-2xl h-[460px] overflow-hidden mx-auto">
              {FEATURES.map((feat, i) => (
                <TextSlide key={i} feature={feat} index={i} total={FEATURES.length} scrollYProgress={scrollYProgress} prefersReduced={!!prefersReduced} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureText({ feature, large }: { feature: CinemaFeature; large?: boolean }) {
  return (
    <div className="space-y-5">
      <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase">{feature.eyebrow}</span>
      <h3
        className={`font-black text-gray-900 dark:text-white tracking-tighter leading-[0.95] whitespace-pre-line ${large ? 'text-5xl lg:text-6xl' : 'text-3xl sm:text-4xl'}`}
      >
        {feature.title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium max-w-md">{feature.description}</p>
    </div>
  );
}
