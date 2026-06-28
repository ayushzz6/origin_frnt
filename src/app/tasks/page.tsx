import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { listTasksForRender } from '@/server/render-loaders';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import type { Task } from '@/types';
import TasksClient from './_client';

export default function TasksPage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <TasksGate />
    </Suspense>
  );
}

async function TasksGate() {
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialTasks: Task[] = [];
  try {
    initialTasks = (await listTasksForRender(user.id)) as unknown as Task[];
  } catch {
    // TasksGoals will still work with client-side optimistic mutations.
  }

  return <TasksClient initialTasks={initialTasks} />;
}
