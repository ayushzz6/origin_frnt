import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { getRoomState, StudyRoomError, type RoomState } from '@/server/study-rooms';
import LobbyClient from './_client';

export default async function StudyRoomLobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialState: RoomState;
  try {
    initialState = await getRoomState(id, user.id);
  } catch (error) {
    if (error instanceof StudyRoomError && (error.status === 403 || error.status === 404)) {
      redirect('/study-rooms');
    }
    throw error;
  }

  if (initialState.room.status === 'in_test') redirect(`/study-rooms/${id}/test`);
  if (initialState.room.status === 'finished') redirect(`/study-rooms/${id}/leaderboard`);
  if (initialState.room.status === 'closed') redirect('/study-rooms');

  return <LobbyClient roomId={id} currentUserId={user.id} initialState={initialState} />;
}
