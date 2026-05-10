'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStoreAsync } from '@/server/store';
import { serializeUser } from '@/server/users';
import { isUserPostgresConfigured } from '@/server/user-postgres';
import { dbUpdateUser } from '@/server/db-users';
import type { User } from '@/types';

type UpdateProfileInput = Partial<{
  name: string;
  class: string;
  student_class: string;
  fieldOfInterest: string;
  referralSource: string;
  avatar: string;
  selectedCourse: string;
  yearsOfExperience: string;
  studentCapacity: string;
  studentClass: string;
  isOnboarded: boolean;
  isDropper: boolean;
  subjects: string[];
  location: string;
}>;

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

async function applyProfileUpdates(userId: string, input: UpdateProfileInput): Promise<User | null> {
  return withStoreAsync(async (store) => {
    const user = store.users.find((u) => u.id === userId);
    if (!user) return null;

    const stringFields: Array<[keyof typeof user, string | undefined]> = [
      ['name', input.name],
      ['fieldOfInterest', input.fieldOfInterest],
      ['referralSource', input.referralSource],
      ['avatar', input.avatar],
      ['selectedCourse', input.selectedCourse],
      ['yearsOfExperience', input.yearsOfExperience],
      ['studentCapacity', input.studentCapacity],
      ['location', input.location],
    ];

    for (const [field, value] of stringFields) {
      if (typeof value === 'string') (user[field] as unknown) = value;
    }

    const studentClass = input.studentClass ?? input.student_class ?? input.class;
    if (typeof studentClass === 'string') user.studentClass = studentClass;
    if (typeof input.isOnboarded === 'boolean') user.isOnboarded = input.isOnboarded;
    if (typeof input.isDropper === 'boolean') user.isDropper = input.isDropper;
    if (Array.isArray(input.subjects)) user.subjects = input.subjects;

    const serialized = serializeUser(store, userId);
    return (serialized as unknown as User) ?? null;
  });
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<User> {
  const current = await requireUser();
  const updated = await applyProfileUpdates(current.id, input);

  if (!updated) {
    throw new Error('Failed to update profile');
  }

  // Persist to Postgres if configured
  if (isUserPostgresConfigured()) {
    try {
      await dbUpdateUser(current.id, {
        name: input.name,
        studentClass: input.studentClass ?? input.class ?? input.student_class,
        fieldOfInterest: input.fieldOfInterest,
        referralSource: input.referralSource,
        avatar: input.avatar,
        selectedCourse: input.selectedCourse,
        yearsOfExperience: input.yearsOfExperience,
        studentCapacity: input.studentCapacity,
        location: input.location,
      });
    } catch (err) {
      console.error('[profile-actions] Failed to persist updates to DB:', err);
    }
  }

  revalidatePath('/');

  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${current.id}`, 'max');
  return updated;
}

/**
 * Finalizes onboarding — marks `isOnboarded: true` and applies any remaining
 * profile fields captured during the flow. Kept distinct from `updateProfileAction`
 * so the revalidation surface can include `/onboarding` → `/dashboard`
 * transitions without over-revalidating elsewhere.
 */
export async function completeOnboardingAction(input: UpdateProfileInput = {}): Promise<User> {
  const current = await requireUser();
  const updated = await applyProfileUpdates(current.id, { ...input, isOnboarded: true });
  if (!updated) throw new Error('Onboarding completion failed — user missing from store.');

  // Persist to Postgres if configured
  if (isUserPostgresConfigured()) {
    try {
      await dbUpdateUser(current.id, {
        isOnboarded: true,
        name: input.name,
        studentClass: input.studentClass ?? input.class ?? input.student_class,
        fieldOfInterest: input.fieldOfInterest,
        referralSource: input.referralSource,
        avatar: input.avatar,
        selectedCourse: input.selectedCourse,
        yearsOfExperience: input.yearsOfExperience,
        studentCapacity: input.studentCapacity,
        location: input.location,
      });
    } catch (err) {
      console.error('[profile-actions] Failed to persist onboarding updates to DB:', err);
    }
  }

  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${current.id}`, 'max');
  revalidatePath('/onboarding');
  revalidatePath('/', 'layout');
  return updated;
}
