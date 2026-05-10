'use client';

import { useEffect } from 'react';
import Dashboard from '@/sections/Dashboard';
import TeacherDashboard from '@/sections/TeacherDashboard';
import type { DashboardChallengePreview } from '@/components/dashboard/DashboardCards';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useTimeTracker } from '@/hooks/useTimeTracker';
import type { Task } from '@/types';

interface DashboardClientProps {
  initialTasks: Task[];
  initialPointsData: {
    totalPoints: number;
    currentTier: string;
    nextTier: string;
    pointsToNext: number;
    progressPercent: number;
    recentLogs: { points: number; type: string; description: string; timestamp: string }[];
  } | null;
  initialChallenge: DashboardChallengePreview | null;
}

export default function DashboardClient({
  initialTasks,
  initialPointsData,
  initialChallenge,
}: DashboardClientProps) {
  const { user, tasks, addTask, toggleTask, removeTask, primeTasks } = useAuth();
  const router = useRouter();
  const { setTimeMode } = useTimeTracker(!!user);

  useEffect(() => {
    primeTasks(initialTasks);
  }, [initialTasks, primeTasks]);

  if (!user) return null;

  if (user.role === 'teacher') {
    return <TeacherDashboard user={user} />;
  }

  if (user.role === 'admin') {
    router.push('/admin');
    return null;
  }

  const handleStartChallenge = (questionId: string) => {
    router.push(`/ogcode/${questionId}`);
  };

  const handleNavigate = (view: string) => {
    const routes: Record<string, string> = {
      'test-list': '/tests',
      'study-corner': '/study-corner',
      'ogcode': '/ogcode',
      'tasks-goals': '/tasks',
      'profile': '/profile',
      'pomodoro': '/pomodoro',
      'leaderboard': '/leaderboard',
      'prestige-milestones': '/milestones',
    };
    router.push(routes[view] || `/${view}`);
  };

  return (
    <Dashboard
      user={user}
      onStartChallenge={handleStartChallenge}
      setTimeMode={setTimeMode}
      onNavigate={handleNavigate}
      tasks={tasks.length > 0 ? tasks : initialTasks}
      onAddTask={addTask}
      onToggleTask={toggleTask}
      onRemoveTask={removeTask}
      initialPointsData={initialPointsData}
      initialChallenge={initialChallenge}
    />
  );
}
