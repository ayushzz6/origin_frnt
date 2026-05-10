import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import {
  getChallengeOfTheDayForRender,
  getPointsSummaryForRender,
  listTasksForRender,
} from '@/server/render-loaders';
import type { Task } from '@/types';
import DashboardClient from './_client';
import DashboardLoading from './loading';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardGate />
    </Suspense>
  );
}

async function DashboardGate() {
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialTasks: Task[] = [];
  let initialPointsData: Awaited<ReturnType<typeof getPointsSummaryForRender>> | null = null;
  let initialChallenge: Awaited<ReturnType<typeof getChallengeOfTheDayForRender>> | null = null;

  const [tasksResult, pointsResult, challengeResult] = await Promise.allSettled([
    listTasksForRender(user.id),
    getPointsSummaryForRender(user.id),
    getChallengeOfTheDayForRender(user.id),
  ]);

  if (tasksResult.status === 'fulfilled') {
    initialTasks = (tasksResult.value ?? []) as unknown as Task[];
  }
  if (pointsResult.status === 'fulfilled') {
    initialPointsData = pointsResult.value;
  }
  if (challengeResult.status === 'fulfilled') {
    initialChallenge = challengeResult.value;
  }

  return (
    <DashboardClient
      initialChallenge={initialChallenge}
      initialPointsData={initialPointsData}
      initialTasks={initialTasks}
    />
  );
}
