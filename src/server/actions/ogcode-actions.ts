'use server';

import { revalidateTag, revalidatePath } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStoreAsync } from '@/server/store';
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
  const result = await withStoreAsync(async (store) => {
    return submitPracticeQuestion(store, user, questionId, payload);
  });

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
