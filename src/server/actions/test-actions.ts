'use server';

import { revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStoreAsyncScoped, TEST_SUBMIT_PERSIST_COLLECTIONS } from '@/server/store';
import {
  createCustomTest,
  submitTest,
  type CustomTestPayload,
  type TestSubmissionPayload,
} from '@/server/assessments';

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

export async function createCustomTestAction(payload: CustomTestPayload) {
  const user = await requireUser();
  // createCustomTest persists its durable record via persistGeneratedCustomTest
  // and mutates no store collection, so no wholesale store write is needed.
  const test = await withStoreAsyncScoped(async (store) => {
    return createCustomTest(store, user, payload);
  }, null);
  revalidateTag('tests', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  return test;
}

export async function submitTestAction(testId: string, payload: TestSubmissionPayload) {
  const user = await requireUser();
  const result = await withStoreAsyncScoped(
    async (store) => {
      return submitTest(store, user, testId, payload);
    },
    { userId: user.id, collections: TEST_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
  );

  revalidateTag('tests', 'max');
  revalidateTag(`test:${testId}`, 'max');
  revalidateTag('milestones', 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  revalidateTag('leaderboard', 'max');
  // Submitting a test can change the user's ranking/stats surfaces and
  // dashboard challenge/recommendation cards.
  revalidateTag('ogcode-catalog', 'max');
  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${user.id}`, 'max');
  return result;
}
