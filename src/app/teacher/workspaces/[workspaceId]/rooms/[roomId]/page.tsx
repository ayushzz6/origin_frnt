export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { LiveRoomDashboard } from "@/components/teacher/LiveRoomDashboard";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string; roomId: string }>;
};

export default async function LiveStudyRoomPage({ params }: Props) {
  const { workspaceId, roomId } = await params;
  
  await loadWorkspaceForRender(workspaceId);

  const room = await getTeacherRoomById(workspaceId, roomId);
  if (!room) notFound();

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <LiveRoomDashboard
        workspaceId={workspaceId}
        room={room}
      />
    </div>
  );
}
