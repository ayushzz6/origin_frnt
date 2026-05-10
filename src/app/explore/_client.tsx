'use client';

import { useRouter } from 'next/navigation';
import Explore from '@/sections/Explore';

const ROUTES: Record<string, string> = {
  dashboard: '/dashboard',
  'test-list': '/tests',
  'study-corner': '/study-corner',
  ogcode: '/ogcode',
  'tasks-goals': '/tasks',
  'pomodoro': '/pomodoro',
  'leaderboard': '/leaderboard',
  'dpp': '/dpp',
  'profile': '/profile',
};

export default function ExploreClient() {
  const router = useRouter();
  return (
    <Explore
      onNavigate={(view) => router.push(ROUTES[view] ?? `/${view}`)}
    />
  );
}
