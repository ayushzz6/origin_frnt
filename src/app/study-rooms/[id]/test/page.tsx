import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { getRoomState, getRoomTestForUser, StudyRoomError, type RoomState } from '@/server/study-rooms';
import { withStoreAsync } from '@/server/store';
import type { Test } from '@/types';
import RoomTestClient from './_client';

export default async function StudyRoomTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect('/');

  let state: RoomState;
  try {
    state = await getRoomState(id, user.id);
  } catch (error) {
    if (error instanceof StudyRoomError && (error.status === 403 || error.status === 404)) {
      redirect('/study-rooms');
    }
    throw error;
  }

  if (state.room.status === 'lobby') redirect(`/study-rooms/${id}/lobby`);
  if (state.room.status === 'finished') redirect(`/study-rooms/${id}/leaderboard`);
  if (state.room.status === 'closed') redirect('/study-rooms');

  const { test } = await withStoreAsync((store) => getRoomTestForUser(store, user, id));
  return <RoomTestClient room={state.room} roomId={id} initialTest={test as unknown as Test} />;
}
