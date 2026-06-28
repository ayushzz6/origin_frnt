'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, Trophy, Check, BookOpen, Target, MessageCircle, TrendingUp, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });

interface MilestonesPageProps {
  onBack: () => void;
  userPoints: number;
}

import { TIER_THRESHOLDS } from '@/lib/achievements';
import { cn } from '@/lib/utils';

const HOW_EARNED = [
  {
    icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Practice Questions', pts: 'Up to +105 pts', rows: [
      { label: 'Easy Question (First Solve)', pts: '+15', note: '10 base + 5 bonus' },
      { label: 'Medium Question (First Solve)', pts: '+30', note: '25 base + 5 bonus' },
      { label: 'Hard Question (First Solve)', pts: '+55', note: '50 base + 5 bonus' },
      { label: 'Insane Question (First Solve)', pts: '+105', note: '100 base + 5 bonus' },
    ]
  },
  {
    icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', label: 'Completing Tests', pts: '+4 pts/correct', rows: [
      { label: 'Correct Answer', pts: '+4', note: 'Per question' },
      { label: 'Wrong Answer', pts: '−1', note: 'Negative marking' },
      { label: 'Unattempted', pts: '0', note: 'No penalty' },
    ]
  },
  {
    icon: MessageCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', label: 'AI Explainer', pts: '+5 pts/session', rows: [
      { label: 'Per AI session', pts: '+5', note: 'Capped at 25/day' },
    ]
  },
];

export default function MilestonesPage({ onBack, userPoints }: MilestonesPageProps) {
  const totalPoints = userPoints;
  const [activeTab, setActiveTab] = useState<'milestones' | 'how'>('milestones');

  const currentTier = [...TIER_THRESHOLDS].reverse().find(t => totalPoints >= t.min) || TIER_THRESHOLDS[0];

  return (
    <div className="min-h-screen neu-surface text-foreground relative overflow-x-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-600/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/30 bg-[hsl(var(--neu-bg))] backdrop-blur-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 neu-raised rounded-full hover:-translate-y-0.5 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-black text-foreground">Prestige Journey</h1>
            <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest">Your path to greatness</p>
          </div>
        </div>

        {/* Points badge */}
        <div className="flex items-center gap-2 px-4 py-2 neu-raised rounded-2xl">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-sm font-black text-primary">{totalPoints.toLocaleString()} pts</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-10 relative z-10">
        {/* Current Rank Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(`neu-raised rounded-[32px] p-4 sm:p-6 mb-6 sm:mb-8 relative overflow-hidden`, currentTier.border ? `ring-1 ${currentTier.border}` : '')}
        >
          <div className={cn("absolute top-0 right-0 w-40 h-40 blur-[60px] opacity-10 pointer-events-none", currentTier.bg)} />
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 shrink-0">
              <OriMascot expression="proud" title="Origin AI" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Rank</p>
              <h2 className={cn(`text-2xl sm:text-3xl font-black`, currentTier.color)}>{currentTier.tier}</h2>
            </div>
          </div>
          {currentTier.next !== Infinity && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>{totalPoints.toLocaleString()} pts</span>
                <span>{currentTier.next.toLocaleString()} pts to next rank</span>
              </div>
              <div className="w-full h-3 neu-inset rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((totalPoints - currentTier.min) / (currentTier.next - currentTier.min)) * 100)}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                />
              </div>
            </div>
          )}
          {currentTier.next === Infinity && (
            <div className="flex items-center gap-2 mt-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-bold text-amber-400">You've reached the pinnacle! Stay on top.</p>
            </div>
          )}
        </motion.div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 neu-inset p-1 rounded-2xl">
          {(['milestones', 'how'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                activeTab === tab
                  ? 'bg-primary text-primary-foreground shadow-[2px_2px_6px_hsl(var(--neu-shadow))]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'milestones' ? '🏆 Milestones' : '⚡ How to Earn'}
            </button>
          ))}
        </div>

        {/* Milestones list */}
        {activeTab === 'milestones' && (
          <div className="space-y-3">
            {TIER_THRESHOLDS.map((t, i) => {
              const unlocked = totalPoints >= t.min;
              const isCurrent = t.tier === currentTier.tier;
              const ptsNeeded = Math.max(0, t.min - totalPoints);
              const TierIcon = t.icon;

              return (
                <motion.div
                  key={t.tier}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-[24px] transition-all',
                    isCurrent
                      ? `neu-raised ring-1 ${t.border}`
                      : unlocked
                        ? 'neu-raised'
                        : 'neu-inset opacity-60'
                  )}
                >
                  {/* Icon */}
                  <div className={cn(`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0`, t.bg)}>
                    <TierIcon className={cn(`w-6 h-6`, t.color)} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(`text-sm font-black`, isCurrent ? t.color : unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                        {t.tier}
                      </p>
                      {isCurrent && (
                        <span className={cn(`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full`, t.bg, t.color)}>
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t.min.toLocaleString()} pts required
                    </p>
                  </div>

                  {/* Status */}
                  <div className="text-right flex-shrink-0">
                    {unlocked ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className={cn(`text-sm font-black`, t.color)}>+{ptsNeeded.toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">pts to unlock</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* How to Earn */}
        {activeTab === 'how' && (
          <div className="space-y-5">
            {HOW_EARNED.map((section, si) => (
              <motion.div
                key={section.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.1 }}
                className={cn(`neu-raised rounded-[24px] p-5`)}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(`w-10 h-10 rounded-xl flex items-center justify-center`, section.bg)}>
                    <section.icon className={cn(`w-5 h-5`, section.color)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">{section.label}</h3>
                    <p className={cn(`text-[10px] font-bold`, section.color)}>{section.pts}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {section.rows.map((row, ri) => (
                    <div key={ri} className="flex items-center justify-between py-2 border-t border-border/40">
                      <div>
                        <p className="text-[12px] font-bold text-foreground">{row.label}</p>
                        <p className="text-[10px] text-muted-foreground">{row.note}</p>
                      </div>
                      <span className={cn(`text-sm font-black`, row.pts.startsWith('−') ? 'text-rose-400' : row.pts === '0' ? 'text-muted-foreground' : section.color)}>
                        {row.pts}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="neu-raised rounded-[24px] p-5 ring-1 ring-amber-400/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-foreground">Pro Tips</h3>
              </div>
              <ul className="space-y-2">
                {[
                  'Solve Insane difficulty questions for maximum point gain.',
                  'First solve on every new question gives a +5 bonus.',
                  'Use the AI Explainer daily for guaranteed +25 pts/day.',
                  'Avoid wrong answers in tests — negative marking reduces points.',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <span className="text-amber-400 font-black mt-0.5">→</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
