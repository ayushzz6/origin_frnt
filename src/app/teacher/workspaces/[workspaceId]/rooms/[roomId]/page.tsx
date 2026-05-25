/**
 * Teacher room detail — Phase 6 completion.
 *
 * The plan calls for a configure-test drawer, invite code card, live
 * participants list, and leaderboard history beyond the bare room
 * metadata. Each of those lives in its own client component; this
 * server file just gates by workspace membership and renders them.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RoomConfigureTestDrawer } from "@/components/teacher/RoomConfigureTestDrawer";
import { RoomInviteCodeCard } from "@/components/teacher/RoomInviteCodeCard";
import { RoomLeaderboardHistory } from "@/components/teacher/RoomLeaderboardHistory";
import { RoomParticipantsList } from "@/components/teacher/RoomParticipantsList";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceId: string; roomId: string }>;
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  lobby: "outline",
  in_test: "default",
  finished: "secondary",
  closed: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  lobby: "Lobby",
  in_test: "Live",
  finished: "Finished",
  closed: "Closed",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default async function TeacherRoomDetailPage({ params }: Props) {
  const { workspaceId, roomId } = await params;
  const { membership, isPlatformAdmin } =
    await loadWorkspaceForRender(workspaceId);

  const room = await getTeacherRoomById(workspaceId, roomId);
  if (!room) notFound();

  const canManage =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
            <Badge variant={STATUS_VARIANT[room.status] ?? "outline"}>
              {STATUS_LABEL[room.status] ?? room.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {room.roomKind === "teacher_room" ? "Teacher Room" : "Student Room"}
            {" · "}
            <span className="font-mono text-xs">{room.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <RoomConfigureTestDrawer workspaceId={workspaceId} room={room} />
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/teacher/workspaces/${workspaceId}/rooms`}>
              Back to Rooms
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test</CardTitle>
            <CardDescription>
              {room.teacherTestId ? "Configured" : "Not configured"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {room.teacherTestId ? (
              <Link
                href={`/teacher/workspaces/${workspaceId}/tests`}
                className="text-sm text-primary hover:underline"
              >
                Open in Tests
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                Use the configure-test drawer to attach a workspace
                test before starting the room.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch</CardTitle>
            <CardDescription>
              {room.batchId ? "Linked" : "Open room (no batch)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {room.batchId ? (
              <Link
                href={`/teacher/workspaces/${workspaceId}/batches/${room.batchId}`}
                className="text-sm text-primary hover:underline"
              >
                Open batch {room.batchId}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                Anyone with the join code can enter.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacity</CardTitle>
            <CardDescription>{room.maxParticipants} max</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Duration:{" "}
              {room.durationSeconds
                ? `${Math.round(room.durationSeconds / 60)} min`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite code</CardTitle>
            <CardDescription>
              Share with students to join the room. Codes expire and can
              be regenerated while the room is in lobby.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoomInviteCodeCard
              workspaceId={workspaceId}
              room={room}
              canManage={Boolean(canManage)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live participants</CardTitle>
            <CardDescription>
              Students currently in the room. Polled every 5 seconds while
              the room is live.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoomParticipantsList workspaceId={workspaceId} room={room} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
          <CardDescription>
            Live ranking for this room, plus the historical leaderboard
            of every session of the attached test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoomLeaderboardHistory workspaceId={workspaceId} room={room} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
          <CardDescription>Lifecycle of this room</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDate(room.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span>{formatDate(room.startedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ended</span>
            <span>{formatDate(room.endedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated</span>
            <span>{formatDate(room.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
