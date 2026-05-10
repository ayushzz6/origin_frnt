import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import OnboardingClient from './_client';

export default function OnboardingPageRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OnboardingGate />
    </Suspense>
  );
}

async function OnboardingGate() {
  const user = await getServerUser();
  if (!user) redirect('/');
  return <OnboardingClient />;
}
