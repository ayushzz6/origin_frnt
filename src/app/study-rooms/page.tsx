import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { listRoomsForUser, type RoomSummary } from '@/server/study-rooms';
import StudyRoomsClient from './_client';

export default function StudyRoomsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading study rooms...</div>}>
      <StudyRoomsGate />
    </Suspense>
  );
}

async function StudyRoomsGate() {
  const user = await getServerUser();
  if (!user) redirect('/');

  let rooms: RoomSummary[] = [];
  try {
    rooms = await listRoomsForUser(user.id);
  } catch {
    rooms = [];
  }

  return <StudyRoomsClient initialRooms={rooms} currentUserId={user.id} />;
}
