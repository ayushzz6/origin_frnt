"use client";

/**
 * Phase 6 — leaderboard history for a teacher room.
 *
 * Two views:
 *  1. The room's own current/finished leaderboard
 *     (`/api/teacher/workspaces/[id]/rooms/[id]/leaderboard`).
 *  2. If a teacher test is attached, the test-level leaderboard
 *     across all sessions
 *     (`/api/teacher/workspaces/[id]/tests/[testId]/leaderboard`).
 *
 * Polls every 10s while the room is `in_test` so the teacher can
 * watch the live ranking; otherwise loads once.
 */

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherRoomSummary } from "@/server/workspaces/types";

type LeaderboardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  score: number | null;
  time_taken_seconds: number | null;
  finished_at: string | null;
  test_result_id: string | null;
  auto_submitted: boolean;
};

type TestLeaderboardEntry = {
  rank: number;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  totalScore: number;
  scorePercentage: number;
  attemptedAt: string;
};

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
};

const POLL_MS = 10000;

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function RoomLeaderboardHistory({ workspaceId, room }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [history, setHistory] = useState<TestLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      const result = await apiJson<{ leaderboard: LeaderboardRow[] }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/leaderboard`,
      );
      if (cancelled) return;
      if (result.ok) {
        setRows(result.data.leaderboard ?? []);
        setError(null);
      } else if (result.status !== 404) {
        setError(result.detail);
      }
      if (room.status === "in_test" && !cancelled) {
        timer = setTimeout(load, POLL_MS);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceId, room.id, room.status]);

  useEffect(() => {
    if (!room.teacherTestId) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await apiJson<{
        leaderboard: TestLeaderboardEntry[];
      }>(
        `/api/teacher/workspaces/${workspaceId}/tests/${room.teacherTestId}/leaderboard?limit=50`,
      );
      if (cancelled) return;
      if (result.ok) setHistory(result.data.leaderboard ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, room.teacherTestId]);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">This room</h3>
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submissions yet. The leaderboard fills as students finish.
          </p>
        ) : (
          <ol className="divide-y rounded-md border">
            {rows.map((row) => (
              <li
                key={row.user_id}
                className="grid grid-cols-[2rem_1fr_5rem_5rem] items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  #{row.rank}
                </span>
                <span className="truncate font-medium">{row.display_name}</span>
                <span className="text-right">{row.score ?? "—"}</span>
                <span className="text-right text-xs text-muted-foreground">
                  {formatDuration(row.time_taken_seconds)}
                  {row.auto_submitted ? (
                    <Badge
                      variant="outline"
                      className="ml-1 text-[10px] uppercase"
                    >
                      auto
                    </Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {room.teacherTestId ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">All sessions of this test</h3>
          {history === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No prior sessions yet.
            </p>
          ) : (
            <ol className="divide-y rounded-md border">
              {history.map((entry) => (
                <li
                  key={`${entry.studentId}-${entry.attemptedAt}`}
                  className="grid grid-cols-[2rem_1fr_5rem_4rem] items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    #{entry.rank}
                  </span>
                  <span className="truncate font-medium">
                    {entry.studentName}
                  </span>
                  <span className="text-right">
                    {entry.score}/{entry.totalScore}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {entry.scorePercentage.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
