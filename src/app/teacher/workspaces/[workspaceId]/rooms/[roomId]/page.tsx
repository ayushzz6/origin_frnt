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
import { RoomConfigureTestDrawer } from "@/components/teacher/RoomConfigureTestDrawer";
import { RoomTestBuilderDrawer } from "@/components/teacher/RoomTestBuilderDrawer";
import { isFeatureEnabled } from "@/lib/feature-flags";
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
        </CardContent>
      </Card>

      <LiveRoomDashboard workspaceId={workspaceId} room={room} />
    </div>
  );
}
