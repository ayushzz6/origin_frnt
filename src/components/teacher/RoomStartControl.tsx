"use client";

/**
 * Starts a configured room test (Phase 15 wiring). The backend route
 * `POST .../rooms/[roomId]/start` (startTeacherRoomTest) already existed but no UI
 * called it — so a configured room could never be started. Shown only while the
 * room is in the lobby with a test attached.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherRoomSummary } from "@/server/workspaces/types";
import { toast } from "sonner";

export function RoomStartControl({
  workspaceId,
  room,
}: {
  workspaceId: string;
  room: TeacherRoomSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (room.status !== "lobby") return null;

  function start() {
    if (!room.teacherTestId) {
      toast.error("Attach or build a test first.");
      return;
    }
    startTransition(async () => {
      const res = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/start`,
        { method: "POST" },
      );
      if (res.ok) {
        toast.success("Room test started — participants advance to the test.");
        router.refresh();
      } else {
        toast.error(res.detail || "Failed to start the room test.");
      }
    });
  }

  return (
    <Button onClick={start} disabled={pending || !room.teacherTestId}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      Start test
    </Button>
  );
}
