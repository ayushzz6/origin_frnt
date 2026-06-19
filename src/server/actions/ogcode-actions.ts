'use server';

import { revalidateTag, revalidatePath } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStoreAsyncScoped, PRACTICE_SUBMIT_PERSIST_COLLECTIONS } from '@/server/store';
import {
  submitPracticeQuestion,
  type PracticeSubmissionPayload,
} from '@/server/assessments';

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

export async function submitOgcodeAnswerAction(
  questionId: string,
  payload: PracticeSubmissionPayload,
) {
  const user = await requireUser();
  const result = await withStoreAsyncScoped(
    async (store) => {
      return submitPracticeQuestion(store, user, questionId, payload);
    },
    { userId: user.id, collections: PRACTICE_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
  );

  revalidateTag('leaderboard', 'max');
  revalidateTag('milestones', 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  revalidateTag(`ogcode-question:${questionId}`, 'max');
  revalidateTag('ogcode-catalog', 'max');
  revalidateTag('user-stats', 'max');
  revalidatePath('/ogcode', 'page');
  revalidatePath(`/ogcode/${questionId}`, 'page');
  return result;
}
