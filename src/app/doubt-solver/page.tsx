import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerFrontendUser } from '@/lib/auth-server';
import DoubtSolverClient from './_client';

export default function DoubtSolverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <DoubtSolverGate />
    </Suspense>
  );
}

async function DoubtSolverGate() {
  const user = await getServerFrontendUser();
  if (!user) redirect('/');
  return <DoubtSolverClient />;
}
