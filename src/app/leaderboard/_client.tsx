'use client';

import { useAuth } from '@/context/AuthContext';
import Leaderboard from '@/sections/Leaderboard';

interface LeaderboardClientProps {
  initialLeaderboard: unknown[];
  initialMyRank: number | null;
}

export default function LeaderboardClient({ initialLeaderboard, initialMyRank }: LeaderboardClientProps) {
  // Page-level redirect guarantees an authenticated user reaches this island;
  // AuthProvider is seeded from the server layout, so `user` is non-null on first render.
  const { user } = useAuth();

  return (
    <Leaderboard
      currentUser={user!}
      initialLeaderboard={initialLeaderboard}
      initialMyRank={initialMyRank}
    />
  );
}
