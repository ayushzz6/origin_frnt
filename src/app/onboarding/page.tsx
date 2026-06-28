import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import OnboardingClient from './_client';

export default function OnboardingPageRoute() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <OnboardingGate />
    </Suspense>
  );
}

async function OnboardingGate() {
  const user = await getServerUser();
  if (!user) redirect('/');
  return <OnboardingClient />;
}
