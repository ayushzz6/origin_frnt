import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import PomodoroClient from './_client';

export default function PomodoroPage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <PomodoroGate />
    </Suspense>
  );
}

async function PomodoroGate() {
  const user = await getServerUser();
  if (!user) redirect('/');
  return <PomodoroClient />;
}
