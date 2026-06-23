"use client";

import type { MouseEvent } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";

/**
 * Hybrid hard delete for a teacher room. Removes the room + its chat, but the
 * student results / analytics and auto-assigned DPPs are kept (different schema).
 * Sits inside the clickable room card, so it stops the click from navigating.
 */
export function RoomDeleteButton({
  workspaceId,
  roomId,
  roomName,
}: {
  workspaceId: string;
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (
      !window.confirm(
        `Delete “${roomName}”? This removes the room and its chat. Student results, analytics, and assigned DPPs are kept.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await apiJson(`/api/teacher/workspaces/${workspaceId}/rooms/${roomId}?hard=1`, {
        method: "DELETE",
      });
      if (result.ok) {
        toast.success("Room deleted.");
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to delete room.");
      }
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={onDelete}
      disabled={pending}
      title="Delete room"
      aria-label={`Delete ${roomName}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
