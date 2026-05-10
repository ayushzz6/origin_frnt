import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getPointsSummaryForRender } from '@/server/render-loaders';
import MilestonesClient from './_client';
import MilestonesLoading from './loading';

export default function MilestonesPage() {
  return (
    <Suspense fallback={<MilestonesLoading />}>
      <MilestonesContent />
    </Suspense>
  );
}

async function MilestonesContent() {
  const serverUser = await getServerUser();
  if (!serverUser) redirect('/');

  let initialPoints = 0;
  try {
    initialPoints = (await getPointsSummaryForRender(serverUser.id)).totalPoints;
  } catch {
    // MilestonesPage will fetch points client-side via /users/points/
  }

  return <MilestonesClient initialPoints={initialPoints} />;
}
