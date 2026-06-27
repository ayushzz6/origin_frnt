'use server';

import { revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { isUserPostgresConfigured } from '@/server/user-postgres';
import { dbCreateTask, dbDeleteTask, dbGetTasks, dbUpdateTask } from '@/server/db-users';
import { createId, withStoreAsync } from '@/server/store';
import type { StoredTask } from '@/server/store';
import { serializeTask } from '@/server/users';

type SerializedTask = ReturnType<typeof serializeTask>;

/**
 * Server-Action task CRUD — replaces the client-side `apiCall('/users/tasks')`
 * round-trip. Callers receive the serialized task (or void for delete) and the
 * server invalidates only the task-tagged render loaders used by dashboard/task
 * surfaces, rather than broad route-level path caches.
 */

async function requireUserId(): Promise<string> {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user.id;
}

function revalidateTaskSurfaces(userId: string) {
  revalidateTag('tasks', 'max');
  revalidateTag(`tasks-user:${userId}`, 'max');
}

export async function listTasksAction(): Promise<SerializedTask[]> {
  const userId = await requireUserId();

  if (isUserPostgresConfigured()) {
    try {
      const tasks = await dbGetTasks(userId);
      return tasks.map(serializeTask);
    } catch (err) {
      console.error('[task-actions] DB list failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    return store.tasks
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(serializeTask);
  });
}

export async function addTaskAction(input: {
  text: string;
  due: string;
  category?: string;
  priority?: string;
}): Promise<SerializedTask> {
  const userId = await requireUserId();
  const text = input.text.trim();
  if (!text || !input.due) throw new Error('text and due are required.');

  if (isUserPostgresConfigured()) {
    try {
      const task = await dbCreateTask(userId, text, input.due, input.category, input.priority);
      revalidateTaskSurfaces(userId);
      return serializeTask(task);
    } catch (err) {
      console.error('[task-actions] DB create failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  const created = await withStoreAsync(async (store) => {
    const task: StoredTask = {
      id: createId('task'),
      userId,
      text,
      completed: false,
      due: input.due,
      createdAt: new Date().toISOString(),
      category: input.category,
      priority: input.priority as StoredTask['priority'],
    };
    store.tasks.push(task);
    return serializeTask(task);
  });
  revalidateTaskSurfaces(userId);
  return created;
}

export async function toggleTaskAction(id: string, completed: boolean): Promise<SerializedTask> {
  const userId = await requireUserId();

  if (isUserPostgresConfigured()) {
    try {
      const updated = await dbUpdateTask(id, userId, { completed });
      if (!updated) throw new Error('Task not found.');
      revalidateTaskSurfaces(userId);
      return serializeTask(updated);
    } catch (err) {
      console.error('[task-actions] DB toggle failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  const updated = await withStoreAsync(async (store) => {
    const task = store.tasks.find((t) => t.id === id && t.userId === userId);
    if (!task) throw new Error('Task not found.');
    task.completed = completed;
    return serializeTask(task);
  });
  revalidateTaskSurfaces(userId);
  return updated;
}

export async function editTaskAction(id: string, text: string): Promise<SerializedTask> {
  const userId = await requireUserId();
  const trimmed = text.trim();
  if (!trimmed) throw new Error('text is required.');

  if (isUserPostgresConfigured()) {
    try {
      const updated = await dbUpdateTask(id, userId, { text: trimmed });
      if (!updated) throw new Error('Task not found.');
      revalidateTaskSurfaces(userId);
      return serializeTask(updated);
    } catch (err) {
      console.error('[task-actions] DB edit failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  const updated = await withStoreAsync(async (store) => {
    const task = store.tasks.find((t) => t.id === id && t.userId === userId);
    if (!task) throw new Error('Task not found.');
    task.text = trimmed;
    return serializeTask(task);
  });
  revalidateTaskSurfaces(userId);
  return updated;
}

export async function removeTaskAction(id: string): Promise<void> {
  const userId = await requireUserId();

  if (isUserPostgresConfigured()) {
    try {
      const ok = await dbDeleteTask(id, userId);
      if (!ok) throw new Error('Task not found.');
      revalidateTaskSurfaces(userId);
      return;
    } catch (err) {
      console.error('[task-actions] DB delete failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  await withStoreAsync(async (store) => {
    const idx = store.tasks.findIndex((t) => t.id === id && t.userId === userId);
    if (idx === -1) throw new Error('Task not found.');
    store.tasks.splice(idx, 1);
  });
  revalidateTaskSurfaces(userId);
}
