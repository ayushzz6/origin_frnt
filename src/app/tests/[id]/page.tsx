import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getTestDetailForRender } from '@/server/render-loaders';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import type { Test } from '@/types';
import TestClient from './_client';

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <TestContent params={params} />
    </Suspense>
  );
}

async function TestContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialTest: Test;
  try {
    initialTest = (await getTestDetailForRender(user.id, id)) as unknown as Test;
  } catch {
    notFound();
  }

  return <TestClient testId={id} initialTest={initialTest} />;
}
