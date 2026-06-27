'use client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Zap, ChevronLeft, ChevronRight, Flame, BookOpen, TrendingUp, Award } from 'lucide-react';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });
import type { Task, User, ViewState } from '@/types';
import DailyTracker from '@/components/dashboard/DailyTracker';
import PastWeekProgress from '@/components/dashboard/PastWeekProgress';
import {
  ChallengeCard,
  type DashboardChallengePreview,
  PastActivitiesCard,
  PlacesToConcentrateCard,
  TodoListCard,
} from '@/components/dashboard/DashboardCards';
import PointsSummary from '@/components/dashboard/PointsSummary';
import { apiCall } from '@/lib/api';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import type { TimeType } from '@/hooks/useTimeTracker';
import { getRegistrationStatusAction } from '@/server/actions/system-actions';

const SLIDES = [
  { id: 1, title: 'Origin V1.0 is Live!',        image: '/carousel/launch.png'           },
  { id: 2, title: 'Beta Launch',                  image: '/carousel/beta_launch.png'      },
  { id: 3, title: 'IPL vs JEE',                   image: '/carousel/ipl.png'              },
  { id: 4, title: 'IPL Comparison',               image: '/carousel/ipl_comparison.png'   },
  { id: 5, title: 'Study Plan vs Reality',        image: '/carousel/study.png'            },
  { id: 6, title: 'Student Comparison',           image: '/carousel/student_comparison.png'},
];

function EventsCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent(c => (c - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setCurrent(c => (c + 1) % SLIDES.length);

  return (
    <div className="relative w-full h-[200px] sm:h-[260px] overflow-hidden group neu-raised">
      {SLIDES.map((slide, idx) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${idx === current ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
        </div>
      ))}

      {/* ← prev arrow */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 neu-btn p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
      >
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>

      {/* → next arrow */}
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 neu-btn p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
      >
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>

      {/* dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 neu-inset px-3 py-2 rounded-full">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2 rounded-full transition-all ${idx === current ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60'}`}
          />
        ))}
      </div>
    </div>
  );
}

interface DashboardProps {
  user: User;
  onStartChallenge: (questionId: string) => void;
  setTimeMode: (mode: TimeType, subject?: string) => void;
  onNavigate: (view: ViewState) => void;
  tasks: Task[];
  onAddTask: (text: string, due: string) => void;
  onEditTask: (id: string, text: string) => void;
  onToggleTask: (id: string) => void;
  onRemoveTask: (id: string) => void;
  initialPointsData?: {
    totalPoints: number;
    currentTier: string;
    nextTier: string;
    pointsToNext: number;
    progressPercent: number;
    recentLogs: { points: number; type: string; description: string; timestamp: string }[];
  } | null;
  initialChallenge?: DashboardChallengePreview | null;
}

import { useNotifications } from '@/context/NotificationContext';
import { TIER_THRESHOLDS, getUserTitle } from '@/lib/achievements';
import { useRef } from 'react';

export default function Dashboard({
  user,
  onStartChallenge,
  setTimeMode,
  onNavigate,
  tasks,
  onAddTask,
  onEditTask,
  onToggleTask,
  onRemoveTask,
  initialPointsData = null,
  initialChallenge = null,
}: DashboardProps) {
  const { addNotification } = useNotifications();
  const [pointsData, setPointsData] = useState<{
    totalPoints: number;
    currentTier: string;
    nextTier: string;
    pointsToNext: number;
    progressPercent: number;
    recentLogs: { points: number; type: string; description: string; timestamp: string }[];
  } | null>(initialPointsData);
  
  const [regStatus, setRegStatus] = useState<{ count: number; limit: number; seatsLeft: number } | null>(null);

  useEffect(() => {
    const fetchRegStatus = async () => {
      const status = await getRegistrationStatusAction();
      setRegStatus(status);
    };
    fetchRegStatus();
  }, []);

  const prevTierRef = useRef<string | null>(pointsData?.currentTier || null);
  const achievementsRef = useRef<Record<string, boolean>>({});

  const { availableWidth } = useLayout();
  const isConstrained = availableWidth < 1024;

  // Track tier changes for notifications
  useEffect(() => {
    if (pointsData?.currentTier) {
      if (prevTierRef.current && prevTierRef.current !== pointsData.currentTier) {
        const newTier = TIER_THRESHOLDS.find(t => t.tier === pointsData.currentTier);
        if (newTier) {
          addNotification({
            title: 'Rank Up! 🏆',
            message: `Amazing! You've ascended to the ${newTier.tier} rank. Your dedication is paying off!`,
            type: 'success'
          });
        }
      }
      prevTierRef.current = pointsData.currentTier;
    }
  }, [pointsData?.currentTier, addNotification]);

  useEffect(() => {
    if (initialPointsData) {
      return;
    }

    const fetchPoints = async () => {
      try {
        const data = await apiCall('/users/points/', { silentAuth: true });
        setPointsData(data);
      } catch (err) {
        if (err instanceof Error && err.message.includes('Session expired')) {
          console.warn("[Dashboard] Session expired during background points fetch.");
        } else {
          console.error("Failed to fetch points", err);
        }
      }
    };
    fetchPoints();
  }, [initialPointsData]);

  // Welcome notification & Achievement tracking
  useEffect(() => {
    if (!user) return;

    // 1. Daily Welcome
    const today = new Date().toISOString().split('T')[0];
    const lastWelcome = localStorage.getItem(`welcome_${user.id}`);
    
    if (lastWelcome !== today) {
      const title = getUserTitle(user);
      const greeting = getGreeting();
      const name = user.name.split(' ')[0];
      
      addNotification({
        title: `${greeting}, ${title ? title + ' ' : ''}${name}! 👋`,
        message: `Welcome back to Origin AI. Ready to push your boundaries today?`,
        type: 'info'
      });
      localStorage.setItem(`welcome_${user.id}`, today);
    }

    // 2. Poll for stats/achievements periodically
    const checkAchievements = async () => {
      try {
        const stats = await apiCall('/assessments/ogcode/user-stats/', { silentAuth: true });
        const newAchievements = stats.achievements || {};
        
        // Initial load - don't notify
        if (Object.keys(achievementsRef.current).length === 0) {
          achievementsRef.current = newAchievements;
          return;
        }

        // Check for new unlocks
        Object.entries(newAchievements).forEach(([key, unlocked]) => {
          if (unlocked && !achievementsRef.current[key]) {
            const achievementNames: Record<string, string> = {
              streak_7: '7-Day Streak! 🔥',
              streak_30: 'Monthly Warrior! 🛡️',
              streak_100: 'Centurion! 💯',
              perfect_score: 'Perfect Score! 🎯',
              subject_master: 'Subject Master! 🧠',
              doubt_master: 'Doubt Resolver! 💡',
            };

            if (achievementNames[key]) {
              addNotification({
                title: 'Achievement Unlocked!',
                message: achievementNames[key],
                type: 'success'
              });
            }
          }
        });
        achievementsRef.current = newAchievements;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Session expired')) {
          console.warn("[Dashboard] Session expired during achievement poll.");
        } else {
          console.error("Failed to check achievements", err);
        }
      }
    };

    checkAchievements();
    const interval = setInterval(checkAchievements, 60000 * 5); // Check every 5 mins
    return () => clearInterval(interval);
  }, [user, addNotification]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    setTimeMode('webpage');
  }, [setTimeMode]);

  const displayName = getUserTitle(user)
    ? `${getUserTitle(user)} ${user.name.split(' ')[0]}`
    : user.name.split(' ')[0];

  /* ── Derived stats ─────────────────────────────────────────────── */
  const streakCount = useMemo(() => {
    const data = user.contributionData;
    if (!data?.length) return 0;
    const active = new Set(
      data.filter(c => c.count > 0)
          .map(c => (typeof c.date === 'string' ? c.date.split('T')[0] : ''))
          .filter(Boolean)
    );
    const ref = new Date();
    // allow today to still be empty — count from yesterday in that case
    const todayKey = ref.toISOString().split('T')[0];
    if (!active.has(todayKey)) ref.setDate(ref.getDate() - 1);
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(ref);
      d.setDate(d.getDate() - i);
      if (active.has(d.toISOString().split('T')[0])) s++;
      else break;
    }
    return s;
  }, [user.contributionData]);

  const totalSolved = useMemo(() =>
    (user.contributionData || []).reduce((sum, c) => sum + (c.count || 0), 0),
    [user.contributionData]
  );

  const todayStudyMins = useMemo(() => {
    const analytics = user.timeAnalytics || [];
    if (!analytics.length) return 0;
    const t = analytics[analytics.length - 1] as { practiceTime?: number; webpageTime?: number; pomodoroTime?: number };
    return Math.floor(((t.practiceTime || 0) + (t.webpageTime || 0) + (t.pomodoroTime || 0)) / 60);
  }, [user.timeAnalytics]);

  const TIER_BADGE: Record<string, string> = {
    Novice: 'text-slate-500 border-slate-300 bg-slate-100 dark:bg-slate-800',
    Learner: 'text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-900/30',
    Scholar: 'text-indigo-600 border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30',
    Expert: 'text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-900/30',
    Master: 'text-pink-600 border-pink-300 bg-pink-50 dark:bg-pink-900/30',
    Grandmaster: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/30',
    Legend: 'text-primary border-primary/40 bg-primary/10',
  };
  const tierBadgeCls = pointsData ? (TIER_BADGE[pointsData.currentTier] ?? TIER_BADGE.Novice) : TIER_BADGE.Novice;

  const stagger = (i: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: 0.06 * i } });

  return (
    <div className="min-h-screen neu-surface font-sans selection:bg-primary/20 selection:text-primary">
      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">

        {/* ── Seats banner ──────────────────────────────────────── */}
        {regStatus && regStatus.seatsLeft > 0 && regStatus.seatsLeft <= 50 && (
          <motion.div {...stagger(0)} className="neu-raised px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs font-bold text-foreground">
                Only <span className="text-primary font-black">{regStatus.seatsLeft}</span> of {regStatus.limit} seats left.
              </p>
            </div>
            <NeuButton accent onClick={() => window.open('https://chat.whatsapp.com/L7X7N7P7N7P7N7P7N7P7N7', '_blank')} className="text-xs font-black uppercase tracking-tighter shrink-0">
              Invite
            </NeuButton>
          </motion.div>
        )}

        {/* ── HERO ──────────────────────────────────────────────── */}
        <motion.div {...stagger(1)} id="tutorial-welcome" className="neu-raised p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            {/* Left */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border ${tierBadgeCls}`}>
                  {pointsData?.currentTier ?? 'Novice'}
                </span>
                {streakCount > 0 && (
                  <motion.span
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-1 text-[11px] font-black text-orange-500"
                  >
                    <Flame className="w-3.5 h-3.5" />{streakCount} day streak
                  </motion.span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-tight">
                {getGreeting()},<br className="sm:hidden" /> {displayName}!
              </h1>
              {pointsData && pointsData.pointsToNext > 0 && (
                <p className="text-xs text-muted-foreground">
                  {pointsData.pointsToNext.toLocaleString()} pts away from <span className="font-bold text-foreground">{pointsData.nextTier}</span>
                </p>
              )}
            </div>
            {/* Ori */}
            <div className="h-16 w-16 sm:h-24 sm:w-24 shrink-0">
              <OriMascot expression="winking" title="Origin AI" />
            </div>
          </div>

          {/* Tier progress bar */}
          {pointsData && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  {pointsData.totalPoints.toLocaleString()} pts
                </span>
                <span className="text-[10px] font-black text-primary">{pointsData.nextTier}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden neu-inset">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pointsData.progressPercent)}%` }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* ── QUICK STATS STRIP ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { icon: BookOpen,   color: 'text-emerald-500', label: 'Solved',      value: totalSolved.toLocaleString() },
            { icon: Flame,      color: 'text-orange-500',  label: 'Day Streak',  value: streakCount > 0 ? String(streakCount) : '—' },
            { icon: Award,      color: 'text-violet-500',  label: 'Rank',        value: pointsData?.currentTier ?? '—' },
            { icon: TrendingUp, color: 'text-cyan-500',    label: 'Today',       value: todayStudyMins > 0 ? `${todayStudyMins}m` : '—' },
          ] as const).map((s, i) => (
            <motion.div key={s.label} {...stagger(i + 2)} className="neu-raised p-4 flex flex-col gap-1.5">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-xl font-black text-foreground leading-none">{s.value}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── CAROUSEL ──────────────────────────────────────────── */}
        <motion.div {...stagger(6)} id="tutorial-events">
          <EventsCarousel />
        </motion.div>

        {/* ── MAIN GRID: heatmap + week-rings | challenge + points ─ */}
        <div className={cn('grid gap-4', isConstrained ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12')}>
          <div className={cn('flex flex-col gap-4', isConstrained ? '' : 'lg:col-span-8')}>
            <motion.div {...stagger(7)} id="tutorial-tracker"><DailyTracker user={user} /></motion.div>
            <motion.div {...stagger(8)} id="tutorial-progress"><PastWeekProgress user={user} /></motion.div>
          </div>
          <div className={cn('flex flex-col gap-4', isConstrained ? '' : 'lg:col-span-4')}>
            <motion.div {...stagger(9)} id="tutorial-challenge">
              <ChallengeCard user={user} initialChallenge={initialChallenge} onStartChallenge={onStartChallenge} />
            </motion.div>
            <motion.div {...stagger(10)} id="tutorial-points">
              <PointsSummary data={pointsData} onNextSteps={() => onNavigate('prestige-milestones')} />
            </motion.div>
          </div>
        </div>

        {/* ── ACTIVITY + FOCUS ──────────────────────────────────── */}
        <div className={cn('grid gap-4', isConstrained ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
          <motion.div {...stagger(11)} id="tutorial-activities"><PastActivitiesCard user={user} /></motion.div>
          <motion.div {...stagger(12)} id="tutorial-focus"><PlacesToConcentrateCard user={user} /></motion.div>
        </div>

        {/* ── TASKS ─────────────────────────────────────────────── */}
        <motion.div {...stagger(13)} id="tutorial-todo">
          <TodoListCard
            tasks={tasks}
            onAddTask={(text, due) => {
              onAddTask(text, due);
              addNotification({ title: 'Goal Set!', message: `"${text}" added to your goals.`, type: 'success' });
            }}
            onEditTask={onEditTask}
            onToggleTask={onToggleTask}
            onRemoveTask={onRemoveTask}
            onViewAll={() => onNavigate('tasks-goals')}
          />
        </motion.div>

      </main>
    </div>
  );
}
