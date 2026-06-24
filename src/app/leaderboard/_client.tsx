'use client';

import { useAuth } from '@/context/AuthContext';
import Leaderboard from '@/sections/Leaderboard';

interface LeaderboardClientProps {
  initialLeaderboard: unknown[];
  initialMyRank: number | null;
  socialEnabled?: boolean;
}

export default function LeaderboardClient({ initialLeaderboard, initialMyRank, socialEnabled }: LeaderboardClientProps) {
  // Page-level redirect guarantees an authenticated user reaches this island;
  // AuthProvider is seeded from the server layout, so `user` is non-null on first render.
  const { user } = useAuth();

  return (
    <Leaderboard
      currentUser={user!}
      initialLeaderboard={initialLeaderboard}
      initialMyRank={initialMyRank}
      socialEnabled={socialEnabled}
    />
  );
}
