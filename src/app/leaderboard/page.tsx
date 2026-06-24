import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getOgcodeLeaderboardForRender } from '@/server/render-loaders';
import { isFeatureEnabled } from '@/lib/feature-flags';
import LeaderboardClient from './_client';
import LeaderboardLoading from './loading';

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardLoading />}>
      <LeaderboardContent />
    </Suspense>
  );
}

async function LeaderboardContent() {
  const serverUser = await getServerUser();
  if (!serverUser) redirect('/');

  let initialLeaderboard: unknown[] = [];
  let initialMyRank: number | null = null;

  try {
    const data = await getOgcodeLeaderboardForRender(serverUser.id, null);
    initialLeaderboard = data.leaderboard;
    initialMyRank = data.myRank;
  } catch {
    // Leaderboard will fetch client-side on mount
  }

  return (
    <LeaderboardClient
      initialLeaderboard={initialLeaderboard}
      initialMyRank={initialMyRank}
      socialEnabled={isFeatureEnabled('studentSocial')}
    />
  );
}
