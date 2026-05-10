'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
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
import type { TimeType } from '@/hooks/useTimeTracker';
import { getRegistrationStatusAction } from '@/server/actions/system-actions';

const MOCK_EVENTS = [
  { 
    id: 1, 
    title: 'Origin V1.0 is Live!', 
    description: 'Welcome, O3 Origin! Your personalized rank booster just got a major upgrade. 🚀 Let\'s find those gaps.', 
    image: '/carousel/launch.png', 
    badge: 'OCTOBER 15, 2026' 
  },
  { 
    id: 2, 
    title: 'The Reality Check: IPL vs. Exams', 
    description: 'IPL will atahi rahega but jee/neet ekbarhi ayegaaa. 🏏📚💀 Focus on your *real* match now.', 
    image: '/carousel/ipl.png', 
    badge: 'IPL SEASON 2026' 
  },
  { 
    id: 3, 
    title: 'Study Plan vs. Reality', 
    description: 'Let\'s reset that focus streak and stop doomscrolling. Origin knows your true power level. 🤓🔄📉', 
    image: '/carousel/study.png', 
    badge: '3:00 AM (MONDAY)' 
  },
];

function EventsCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % MOCK_EVENTS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[200px] sm:h-[260px] rounded-3xl overflow-hidden group border border-slate-200/50 dark:border-slate-800/50 shadow-2xl">
      {MOCK_EVENTS.map((event, idx) => (
        <div
          key={event.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${idx === current ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <img src={event.image} alt={event.title} className="w-full h-full object-cover opacity-60 dark:opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent dark:from-background dark:via-background/60 dark:to-transparent" />
          <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-center">
            <span className="inline-block px-3 py-1 bg-primary/10 dark:bg-primary/20 backdrop-blur-md border border-primary/20 rounded-full text-[10px] font-black tracking-widest uppercase text-primary w-fit mb-4 shadow-sm">
              {event.badge}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-[#334155] dark:text-white mb-2 sm:mb-3 tracking-tight leading-tight max-w-2xl">{event.title}</h2>
            <p className="text-sm sm:text-base text-[#475569] dark:text-slate-300 max-w-xl leading-relaxed font-medium line-clamp-2 sm:line-clamp-none">{event.description}</p>
          </div>
        </div>
      ))}

      {/* Navigation Dots */}
      <div className="absolute bottom-6 right-6 flex gap-2">
        {MOCK_EVENTS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-all ${idx === current ? 'w-6 bg-primary shadow-sm' : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'}`}
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

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-500 relative overflow-x-hidden">
      {/* Premium Background Decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-40 dark:opacity-20">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.02] mix-blend-overlay" />
      </div>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        {/* Registration Status Banner */}
        {regStatus && regStatus.seatsLeft > 0 && regStatus.seatsLeft <= 50 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary uppercase tracking-wider">Limited Seats Remaining!</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Only {regStatus.seatsLeft} out of {regStatus.limit} seats left for this phase.</p>
              </div>
            </div>
            <button 
              onClick={() => window.open('https://chat.whatsapp.com/L7X7N7P7N7P7N7P7N7P7N7', '_blank')}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-primary/20 uppercase tracking-tighter"
            >
              Invite Friends
            </button>
          </motion.div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-[#334155] dark:text-white tracking-tight">
              {getGreeting()}, {displayName}!
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium mt-1">
              {pointsData?.pointsToNext && pointsData.pointsToNext > 0 
                ? `You're just ${pointsData.pointsToNext.toLocaleString()} pts away from becoming a ${pointsData.nextTier}!`
                : "You've reached the absolute peak of excellence!"}
            </p>
          </div>
        </div>

        <motion.div
          id="tutorial-events"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <EventsCarousel />
        </motion.div>

        <div className={cn(
          "grid gap-6 sm:gap-8",
          isConstrained ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"
        )}>
          {/* Main Content Grid (8/4 split for primary activity) */}
          <div className={cn(
            "flex flex-col gap-6 sm:gap-8",
            isConstrained ? "" : "lg:col-span-8"
          )}>
            <div id="tutorial-tracker" className="h-auto">
              <DailyTracker user={user} />
            </div>
            <div id="tutorial-progress" className="h-auto">
              <PastWeekProgress user={user} />
            </div>
          </div>

          <div className={cn(
            "flex flex-col gap-6 sm:gap-8",
            isConstrained ? "" : "lg:col-span-4"
          )}>
            <div id="tutorial-challenge">
              <ChallengeCard
                user={user}
                initialChallenge={initialChallenge}
                onStartChallenge={onStartChallenge}
              />
            </div>
            <div id="tutorial-points">
              <PointsSummary data={pointsData} onNextSteps={() => onNavigate('prestige-milestones')} />
            </div>
          </div>
        </div>

        {/* Insights & Tasks Layer (Wider for better visibility) */}
        <div className="space-y-6 sm:space-y-8">
          <div className={cn(
            "grid gap-6 sm:gap-8",
            isConstrained ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          )}>
            <div id="tutorial-activities">
              <PastActivitiesCard user={user} />
            </div>
            <div id="tutorial-focus">
              <PlacesToConcentrateCard user={user} />
            </div>
          </div>

          <div id="tutorial-todo" className="w-full">
            <TodoListCard 
              tasks={tasks}
              onAddTask={(text, due) => {
                onAddTask(text, due);
                addNotification({
                  title: 'Goal Set!',
                  message: `"${text}" has been added to your goals. Stay focused!`,
                  type: 'success'
                });
              }}
              onToggleTask={onToggleTask}
              onRemoveTask={onRemoveTask}
              onViewAll={() => onNavigate('tasks-goals')}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
