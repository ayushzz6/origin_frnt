export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveRoomDashboard } from "@/components/teacher/LiveRoomDashboard";
import { LiveRoomDashboardRealtime } from "@/components/teacher/LiveRoomDashboardRealtime";
import { RoomConfigureTestDrawer } from "@/components/teacher/RoomConfigureTestDrawer";
import { RoomStartControl } from "@/components/teacher/RoomStartControl";
import { RoomTestBuilderDrawer } from "@/components/teacher/RoomTestBuilderDrawer";
import { getServerUser } from "@/lib/auth-server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getRoomState, StudyRoomError, type RoomState } from "@/server/study-rooms";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import { listTeacherQuestions } from "@/server/workspaces/questions-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string; roomId: string }>;
};

export default async function LiveStudyRoomPage({ params }: Props) {
  const { workspaceId, roomId } = await params;

  await loadWorkspaceForRender(workspaceId);

  const room = await getTeacherRoomById(workspaceId, roomId);
  if (!room) notFound();

  const ogcodeEnabled = isFeatureEnabled("teacherOgcode");
  // Bag questions power the in-place builder's Question Bag tab.
  const bagQuestions = await listTeacherQuestions(workspaceId, { status: "all" });

  // Teacher Live Rooms: when enabled, seed the real-time dashboard with the
  // room state (the teacher is the room's admin participant, so getRoomState
  // succeeds). Falls back to the legacy dashboard if the flag is off or the
  // teacher is somehow not an active member.
  let liveState: RoomState | null = null;
  let liveUserId: string | null = null;
  if (isFeatureEnabled("liveRooms")) {
    const user = await getServerUser();
    if (user) {
      try {
        liveState = await getRoomState(roomId, user.id);
        liveUserId = user.id;
      } catch (error) {
        if (!(error instanceof StudyRoomError)) throw error;
        liveState = null;
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-in space-y-6">
      {/* Room test setup — build a mixed-source test in place, or attach an existing one. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Room test</CardTitle>
          <CardDescription>
            {room.teacherTestId
              ? "A test is configured for this room. Build a new one or swap it while the room is in the lobby."
              : "Build a test (OG Code + Question Bag) or attach an existing one before starting the room."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <RoomTestBuilderDrawer
            workspaceId={workspaceId}
            room={room}
            bagQuestions={bagQuestions}
            ogcodeEnabled={ogcodeEnabled}
          />
          <RoomConfigureTestDrawer workspaceId={workspaceId} room={room} />
          <RoomStartControl workspaceId={workspaceId} room={room} />
        </CardContent>
      </Card>

      {liveState && liveUserId ? (
        <LiveRoomDashboardRealtime
          workspaceId={workspaceId}
          room={room}
          currentUserId={liveUserId}
          initialState={liveState}
        />
      ) : (
        <LiveRoomDashboard workspaceId={workspaceId} room={room} />
      )}
    </div>
  );
}
