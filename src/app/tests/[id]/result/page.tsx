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

  // Both loaders are independent — fetch them concurrently rather than waiting
  // for the history list before starting the single-result lookup.
  const [initialHistory, exactResult] = await Promise.all([
    listTestResultsForRender(user.id, id)
      .then((rows) => rows as unknown as TestResult[])
      .catch(() => [] as TestResult[]), // Client leaf will do a final fallback fetch.
    requestedResultId
      ? getSingleResultForRender(user.id, requestedResultId)
          .then((row) => row as unknown as TestResult)
          .catch(() => null)
      : Promise.resolve<TestResult | null>(null),
  ]);

  const history = exactResult
    ? [exactResult, ...initialHistory.filter((result) => result.id !== exactResult?.id)]
    : initialHistory;

  return <ResultClient testId={id} initialHistory={history} requestedResultId={requestedResultId} />;
}
