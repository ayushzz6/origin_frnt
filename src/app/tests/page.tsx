import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerFrontendUser } from '@/lib/auth-server';
import { shouldRedirectFreeStudent } from '@/server/entitlements';
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
  // Tests are premium; free students are sent to /premium. Premium students see
  // the list filtered to their entitled subjects (enforced in listTestPreviews).
  if (shouldRedirectFreeStudent(user)) redirect('/premium');

  let initialTests: TestPreview[] = [];
  try {
    initialTests = (await listTestsForRender(user.id)) as unknown as TestPreview[];
  } catch {
    // Fall back gracefully; TestList will fetch client-side on mount
  }

  return <TestsClient initialTests={initialTests} />;
}
