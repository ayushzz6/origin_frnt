'use server';

import { getRegistrationStatus } from '@/server/users';

/**
 * Public server action to check how many registration slots are remaining.
 * Pass role="teacher" to get the teacher-scoped count and cap; otherwise
 * returns the global user count and cap.
 * Returns { count: number, limit: number, seatsLeft: number }
 */
export async function getRegistrationStatusAction(role?: 'student' | 'teacher' | 'admin' | null) {
  return await getRegistrationStatus(role);
}
