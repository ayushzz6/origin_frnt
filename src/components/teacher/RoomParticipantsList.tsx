"use client";

/**
 * Phase 6 — live participants for a teacher room.
 *
 * Polls the workspace participants endpoint every 5 seconds while the
 * room is in `lobby` or `in_test`. The legacy study-room SSE stream
 * is admin-scoped (the teacher *is* the admin, so they could use it
 * directly), but a polled REST endpoint keeps the workspace UI free
 * of the SSE plumbing and stays in line with the rest of the teacher
 * surface.
 */

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherRoomSummary } from "@/server/workspaces/types";

type Participant = {
  user_id: string;
  display_name: string;
  role: "admin" | "participant";
  joined_at: string;
  left_at: string | null;
  kicked: boolean;
  finished_at: string | null;
  score: number | null;
  rank: number | null;
};

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
};

const POLL_MS = 5000;

export function RoomParticipantsList({ workspaceId, room }: Props) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      const result = await apiJson<{ participants: Participant[] }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/participants`,
      );
      if (cancelled) return;
      if (result.ok) {
        setParticipants(result.data.participants ?? []);
        setError(null);
      } else {
        setError(result.detail);
      }
      const live = room.status === "lobby" || room.status === "in_test";
      if (live && !cancelled) timer = setTimeout(load, POLL_MS);
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceId, room.id, room.status]);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (participants === null) {
    return (
      <p className="text-sm text-muted-foreground">Loading participants…</p>
    );
  }

  const active = participants.filter((p) => !p.left_at && !p.kicked);
  const left = participants.filter((p) => p.left_at || p.kicked);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {active.length} active · {left.length} left
      </p>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No participants in the room yet. Share the invite code to let
          students join.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {active.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{p.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(p.joined_at).toLocaleTimeString()}
                  {p.finished_at
                    ? ` · finished ${new Date(p.finished_at).toLocaleTimeString()}`
                    : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {p.role === "admin" ? (
                  <Badge variant="outline" className="text-xs">
                    Admin
                  </Badge>
                ) : null}
                {p.score != null ? (
                  <Badge variant="secondary" className="text-xs">
                    {p.score} pts
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
