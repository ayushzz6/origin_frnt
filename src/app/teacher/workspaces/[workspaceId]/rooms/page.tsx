export const dynamic = "force-dynamic";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RoomCreateDialog } from "@/components/teacher/RoomCreateDialog";
import { RoomDeleteButton } from "@/components/teacher/RoomDeleteButton";
import { listTeacherRooms } from "@/server/workspaces/teacher-rooms";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

const STATUS_COLORS: Record<string, string> = {
  lobby: "text-blue-600",
  in_test: "text-orange-600",
  finished: "text-green-600",
  closed: "text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  lobby: "Lobby",
  in_test: "Live",
  finished: "Finished",
  closed: "Closed",
};

export default async function TeacherRoomsPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canCreate =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  const rooms = await listTeacherRooms(workspaceId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rooms.length} rooms total.
          </p>
        </div>
        {canCreate && <RoomCreateDialog workspaceId={workspaceId} />}
      </div>

      {rooms.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No rooms yet</CardTitle>
            <CardDescription>
              Create a live test room for your enrolled students.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/teacher/workspaces/${workspaceId}/rooms/${room.id}`}
              className="block"
            >
              <Card className="transition-all hover:border-primary/40 hover:shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate">{room.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`text-xs font-mono uppercase tracking-wide ${STATUS_COLORS[room.status] ?? ""}`}>
                        {STATUS_LABELS[room.status] ?? room.status}
                      </span>
                      {canCreate && (
                        <RoomDeleteButton workspaceId={workspaceId} roomId={room.id} roomName={room.name} />
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {room.roomKind === "teacher_room" ? "Teacher Room" : "Student Room"}
                  </p>
                  {room.teacherTestId && (
                    <p className="text-xs text-muted-foreground">
                      Test configured
                    </p>
                  )}
                  {room.batchId && (
                    <p className="text-xs text-muted-foreground">
                      Batch: {room.batchId}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}