import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getProfileStatsForRender } from '@/server/render-loaders';
import { isFeatureEnabled } from '@/lib/feature-flags';
import ProfileClient from './_client';

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProfileGate />
    </Suspense>
  );
}

async function ProfileGate() {
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialProfileStats: Awaited<ReturnType<typeof getProfileStatsForRender>> | null = null;
  try {
    initialProfileStats = await getProfileStatsForRender(user.id);
  } catch {
    // Profile page can fall back to client fetch.
  }

  return (
    <ProfileClient
      initialProfileStats={initialProfileStats}
      premiumEnabled={isFeatureEnabled('premiumSubscriptions')}
    />
  );
}
