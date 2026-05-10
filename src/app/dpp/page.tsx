import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { listGeneratedDppsForRender, type GeneratedDppForRender } from '@/server/render-loaders';
import DPPClient from './_client';
import DppLoading from './loading';

export default function DPPPage() {
  return (
    <Suspense fallback={<DppLoading />}>
      <DPPGate />
    </Suspense>
  );
}

async function DPPGate() {
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialDpps: GeneratedDppForRender[] | null = null;
  try {
    initialDpps = await listGeneratedDppsForRender(user.id);
  } catch {
    // Fall back to the existing client fetch when analytics storage is unavailable.
  }

  return <DPPClient initialDpps={initialDpps} />;
}
