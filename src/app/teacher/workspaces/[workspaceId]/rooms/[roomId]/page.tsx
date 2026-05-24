/**
 * Teacher room detail — audit fix R-4 (A-13).
 *
 * Before this route existed the rooms list was a dead-end: cards
 * weren't clickable and there was nowhere to inspect a room's batch,
 * test, or status. This page is intentionally minimal — full
 * participant-list and live-leaderboard views are tracked separately.
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
  // Auth + workspace gating runs in the workspace layout; this just
  // confirms the room belongs to this workspace.
  await loadWorkspaceForRender(workspaceId);

  const room = await getTeacherRoomById(workspaceId, roomId);
  if (!room) notFound();

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
        <Button asChild variant="outline">
          <Link href={`/teacher/workspaces/${workspaceId}/rooms`}>
            Back to Rooms
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test</CardTitle>
            <CardDescription>
              {room.teacherTestId ? "Configured" : "Not configured"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {room.teacherTestId ? (
              <Link
                href={`/teacher/workspaces/${workspaceId}/tests`}
                className="text-sm text-primary hover:underline"
              >
                View tests list
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                No test linked to this room.
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
