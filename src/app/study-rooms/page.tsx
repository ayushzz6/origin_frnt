import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { getServerFrontendUser } from '@/lib/auth-server';
import { shouldRedirectFreeStudent } from '@/server/entitlements';
import { listRoomsForUser, type RoomSummary } from '@/server/study-rooms';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import StudyRoomsClient from './_client';

export default function StudyRoomsPage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <StudyRoomsGate />
    </Suspense>
  );
}

async function StudyRoomsGate() {
  const user = await getServerFrontendUser();
  if (!user) redirect('/');
  // Study Rooms is a global-unlock premium feature (Phase 1.4).
  if (shouldRedirectFreeStudent(user)) redirect('/premium');

  let rooms: RoomSummary[] = [];
  try {
    rooms = await listRoomsForUser(user.id);
  } catch {
    rooms = [];
  }

  return <StudyRoomsClient initialRooms={rooms} currentUserId={user.id} />;
}
