'use server';

import { getRegistrationStatus } from '@/server/users';

/**
 * Public server action to check how many registration slots are remaining.
 * Returns { count: number, limit: number, seatsLeft: number }
 */
export async function getRegistrationStatusAction() {
  return await getRegistrationStatus();
}
