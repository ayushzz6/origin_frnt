import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerFrontendUser } from '@/lib/auth-server';
import {
  getOgcodeIndexDataForRender,
} from '@/server/render-loaders';
import OGCodeClient from './_client';
import OGCodeLoading from './loading';

const INITIAL_PAGE_SIZE = 60;

type PageProps = {
  searchParams: Promise<{
    subject?: string;
    difficulty?: string;
    status?: string;
    // Repeated ?chapters=… params come through as a string[]; a single value as string.
    chapters?: string | string[];
    search?: string;
  }>;
};

function toChapterList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map((entry) => entry.trim()).filter(Boolean);
}

export default function OGCodePage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<OGCodeLoading />}>
      <OGCodeContent searchParams={searchParams} />
    </Suspense>
  );
}

function normalizeStatus(status: string | undefined): 'solved' | 'unsolved' | null {
  if (!status) {
    return null;
  }

  const normalized = status.trim().toLowerCase();
  if (normalized === 'solved') {
    return 'solved';
  }
  if (normalized === 'unsolved') {
    return 'unsolved';
  }
  return null;
}

async function OGCodeContent({ searchParams }: PageProps) {
  const user = await getServerFrontendUser();
  if (!user) redirect('/');
  if (user.role === 'student' && !user.isPremium) {
    redirect('/premium');
  }

  const resolvedSearchParams = await searchParams;
  let initialData: Awaited<ReturnType<typeof getOgcodeIndexDataForRender>> | null = null;

  try {
    initialData = await getOgcodeIndexDataForRender(user.id, {
      subject: resolvedSearchParams.subject ?? null,
      difficulty: resolvedSearchParams.difficulty ?? null,
      status: normalizeStatus(resolvedSearchParams.status),
      search: resolvedSearchParams.search ?? null,
      chapters: toChapterList(resolvedSearchParams.chapters),
      limit: INITIAL_PAGE_SIZE,
      offset: 0,
    });
  } catch {
    // Fall back gracefully; the client list will refresh through the API bridge.
  }

  return (
    <OGCodeClient
      initialQuestionPage={initialData?.questionPage ?? null}
      initialUserStats={initialData?.userStats ?? null}
      initialSubjectRanks={initialData?.subjectRanks ?? null}
      initialChapters={initialData?.chapters ?? null}
    />
  );
}
