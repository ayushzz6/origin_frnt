import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import {
  getRoomDppPlans,
  getRoomLeaderboard,
  getRoomState,
  StudyRoomError,
  type RoomDppPlanSummary,
  type RoomLeaderboardRow,
  type RoomState,
} from '@/server/study-rooms';
import RoomLeaderboardClient from './_client';

export default async function StudyRoomLeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect('/');

  let payload: [RoomState, RoomLeaderboardRow[], RoomDppPlanSummary[]];
  try {
    payload = await Promise.all([
      getRoomState(id, user.id),
      getRoomLeaderboard(id, user.id),
      getRoomDppPlans(id, user.id),
    ]);
  } catch (error) {
    if (error instanceof StudyRoomError && (error.status === 403 || error.status === 404)) {
      redirect('/study-rooms');
    }
    throw error;
  }

  const [state, leaderboard, dpps] = payload;

  return (
    <RoomLeaderboardClient
      room={state.room}
      currentUserId={user.id}
      initialLeaderboard={leaderboard}
      initialDpps={dpps}
    />
  );
}
