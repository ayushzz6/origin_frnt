import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getSingleResultForRender, listTestResultsForRender } from '@/server/render-loaders';
import type { TestResult } from '@/types';
import ResultClient from './_client';

type ResultPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ result?: string | string[]; resultId?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function ResultPage({ params, searchParams }: ResultPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-slate-400">
          Analyzing Results...
        </div>
      }
    >
      <ResultContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ResultContent({ params, searchParams }: ResultPageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const requestedResultId = firstParam(query.result) ?? firstParam(query.resultId);
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialHistory: TestResult[] = [];
  let exactResult: TestResult | null = null;
  try {
    initialHistory = (await listTestResultsForRender(user.id, id)) as unknown as TestResult[];
  } catch {
    // Client leaf will do a final fallback fetch.
  }

  if (requestedResultId) {
    try {
      exactResult = (await getSingleResultForRender(user.id, requestedResultId)) as unknown as TestResult;
    } catch {
      exactResult = null;
    }
  }

  const history = exactResult
    ? [exactResult, ...initialHistory.filter((result) => result.id !== exactResult?.id)]
    : initialHistory;

  return <ResultClient testId={id} initialHistory={history} requestedResultId={requestedResultId} />;
}
