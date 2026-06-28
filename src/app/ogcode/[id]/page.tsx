import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getPracticeQuestionDetailForRender } from '@/server/render-loaders';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import type { PracticeQuestion } from '@/types';
import OGCodeClient from './_client';

export default function OGCodeWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <OGCodeContent params={params} />
    </Suspense>
  );
}

async function OGCodeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialQuestion: PracticeQuestion | null = null;
  try {
    initialQuestion = (await getPracticeQuestionDetailForRender(user.id, id)) as unknown as PracticeQuestion;
  } catch {
    // The workspace will do a client fetch as a fallback.
  }

  return <OGCodeClient questionId={id} initialQuestion={initialQuestion} />;
}
