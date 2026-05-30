import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerFrontendUser } from '@/lib/auth-server';
import { listTestsForRender } from '@/server/render-loaders';
import TestsClient from './_client';
import TestsLoading from './loading';
import type { TestPreview } from '@/types';

export default function TestsPage() {
  return (
    <Suspense fallback={<TestsLoading />}>
      <TestsContent />
    </Suspense>
  );
}

async function TestsContent() {
  const user = await getServerFrontendUser();
  if (!user) redirect('/');

  let initialTests: TestPreview[] = [];
  try {
    initialTests = (await listTestsForRender(user.id)) as unknown as TestPreview[];
  } catch {
    // Fall back gracefully; TestList will fetch client-side on mount
  }

  return <TestsClient initialTests={initialTests} />;
}
