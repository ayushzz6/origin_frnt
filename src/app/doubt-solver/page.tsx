import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerFrontendUser } from '@/lib/auth-server';
import { shouldRedirectFreeStudent } from '@/server/entitlements';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import DoubtSolverClient from './_client';

export default function DoubtSolverPage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <DoubtSolverGate />
    </Suspense>
  );
}

async function DoubtSolverGate() {
  const user = await getServerFrontendUser();
  if (!user) redirect('/');
  // AI Explainer / Doubt Solver is a global-unlock premium feature (Phase 1.4).
  if (shouldRedirectFreeStudent(user)) redirect('/premium');
  return <DoubtSolverClient />;
}
