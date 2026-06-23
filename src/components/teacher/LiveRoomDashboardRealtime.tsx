"use client";

/**
 * Teacher Live Rooms — real-time room dashboard (replaces the mock
 * LiveRoomDashboard when the `liveRooms` flag is on).
 *
 * Reuses the student study-room real-time stack: the teacher is seeded as the
 * room's admin *participant*, so the same SSE stream + chat + kick endpoints
 * work without any teacher-specific duplicates. We wrap the room in the shared
 * StudyRoomProvider (with a teacher redirect target) and render live chat +
 * typing, a real presence list that distinguishes "giving the test" from "in
 * the room but not giving it", a live leaderboard, and admin moderation.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, BarChart3, Clock, Loader2, Radio, Search, Square, UserX, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LobbyChat } from "@/components/study-rooms/LobbyChat";
import { RoomInviteCodeCard } from "@/components/teacher/RoomInviteCodeCard";
import { TestCohortAnalytics } from "@/components/teacher/TestCohortAnalytics";
import { StudyRoomProvider, useStudyRoom, type StudyRoomStatePayload } from "@/context/StudyRoomContext";
import { apiJson } from "@/lib/teacher-client";
import type { ParticipantSummary } from "@/lib/study-rooms/events";
import type { TeacherRoomSummary } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
  currentUserId: string;
  initialState: StudyRoomStatePayload;
};

/** How long after the last heartbeat a participant is still considered online. */
const ONLINE_WINDOW_MS = 35_000;

type LiveStatus = "submitted" | "giving_test" | "in_room" | "offline" | "left";

function liveStatus(p: ParticipantSummary, roomStatus: string, now: number): LiveStatus {
  if (p.left_at || p.kicked) return "left";
  const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
  const online = lastSeen > 0 && now - lastSeen < ONLINE_WINDOW_MS;
  if (p.finished_at) return "submitted";
  if (roomStatus === "in_test") {
    if (p.entered_test_at && online) return "giving_test";
    return online ? "in_room" : "offline";
  }
  return online ? "in_room" : "offline";
}

const STATUS_META: Record<LiveStatus, { label: string; dot: string; badge: string }> = {
  giving_test: { label: "Giving test", dot: "bg-emerald-500 animate-pulse", badge: "text-emerald-600 dark:text-emerald-400" },
  in_room: { label: "In room", dot: "bg-sky-500", badge: "text-sky-600 dark:text-sky-400" },
  submitted: { label: "Submitted", dot: "bg-violet-500", badge: "text-violet-600 dark:text-violet-400" },
  offline: { label: "Offline", dot: "bg-slate-400", badge: "text-muted-foreground" },
  left: { label: "Left", dot: "bg-destructive", badge: "text-destructive" },
};

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function LiveRoomDashboardRealtime({ workspaceId, room, currentUserId, initialState }: Props) {
  return (
    <StudyRoomProvider
      roomId={room.id}
      currentUserId={currentUserId}
      initialState={initialState}
      listHref={`/teacher/workspaces/${workspaceId}/rooms`}
    >
      <DashboardInner
        workspaceId={workspaceId}
        roomId={room.id}
        currentUserId={currentUserId}
        teacherTestId={room.teacherTestId}
      />
    </StudyRoomProvider>
  );
}

function DashboardInner({
  workspaceId,
  roomId,
  currentUserId,
  teacherTestId,
}: {
  workspaceId: string;
  roomId: string;
  currentUserId: string;
  teacherTestId: string | null;
}) {
  const router = useRouter();
  const live = useStudyRoom();
  const { room, participants, messages, pending, typingUsers, sendChat, sendTyping, kickParticipant, refresh, isConnected, is_admin } = live;
  const [closing, startClose] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");

  const inTest = room.status === "in_test";
  const isClosed = room.status === "closed";
  const finished = room.status === "finished" || room.status === "closed";

  // Refresh full room state every 5s while active: pulls fresh heartbeats
  // (online / giving-test) and triggers the server-side auto-finish on read.
  useEffect(() => {
    if (room.status !== "lobby" && room.status !== "in_test") return;
    const interval = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, [room.status, refresh]);

  // 1s clock tick — drives both the live countdown and online/offline detection
  // (offline depends on elapsed time since the last heartbeat), so it runs in
  // every room state, not just during a test.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadlineMs = inTest && room.started_at && room.duration_seconds
    ? new Date(room.started_at).getTime() + room.duration_seconds * 1000
    : null;
  const remaining = deadlineMs != null ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : null;

  // When the timer hits zero, refresh once so the server's lazy auto-finish
  // flips the room to "finished" and the leaderboard settles.
  const finishedRefreshRef = useRef(false);
  useEffect(() => {
    if (remaining === 0 && !finishedRefreshRef.current) {
      finishedRefreshRef.current = true;
      void refresh().catch(() => undefined);
    }
    if (remaining && remaining > 0) finishedRefreshRef.current = false;
  }, [remaining, refresh]);

  // Students = everyone except the viewing teacher.
  const students = useMemo(
    () => participants.filter((p) => p.user_id !== currentUserId),
    [participants, currentUserId],
  );
  const active = useMemo(() => students.filter((p) => !p.left_at && !p.kicked), [students]);

  // Instant client-side narrowing of the loaded list (the same query also hits
  // the pg_trgm endpoint server-side for larger cohorts).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter((p) => p.display_name.toLowerCase().includes(q));
  }, [active, query]);

  const counts = useMemo(() => {
    const acc = { giving: 0, inRoom: 0, submitted: 0, online: 0 };
    for (const p of active) {
      const status = liveStatus(p, room.status, now);
      if (status !== "offline") acc.online += 1;
      if (status === "giving_test") acc.giving += 1;
      else if (status === "in_room") acc.inRoom += 1;
      else if (status === "submitted") acc.submitted += 1;
    }
    return acc;
  }, [active, room.status, now]);

  const leaderboard = useMemo(
    () =>
      [...active]
        .filter((p) => p.score != null || p.finished_at)
        .sort((a, b) =>
          (b.score ?? -1) - (a.score ?? -1) ||
          (a.time_taken_seconds ?? Number.MAX_SAFE_INTEGER) - (b.time_taken_seconds ?? Number.MAX_SAFE_INTEGER),
        ),
    [active],
  );

  function handleEndTest(): void {
    if (!window.confirm("End this live room for everyone? Students will be returned to their rooms list.")) return;
    startClose(async () => {
      const result = await apiJson(`/api/teacher/workspaces/${workspaceId}/rooms/${roomId}`, { method: "DELETE" });
      if (result.ok) {
        toast.success("Live room ended.");
        router.push(`/teacher/workspaces/${workspaceId}/rooms`);
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to end the room.");
      }
    });
  }

  async function handleKick(userId: string, name: string): Promise<void> {
    if (!window.confirm(`Remove ${name} from the room?`)) return;
    try {
      await kickParticipant(userId);
      toast.success(`${name} was removed.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove participant.");
    }
  }

  const statusBadge =
    room.status === "in_test"
      ? { label: "Live session", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
      : room.status === "lobby"
        ? { label: "Lobby", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" }
        : room.status === "finished"
          ? { label: "Finished", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" }
          : { label: "Closed", className: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Radio className={`h-3 w-3 ${isConnected ? "text-emerald-500" : "text-muted-foreground"}`} />
                {isConnected ? "Connected" : "Reconnecting…"}
              </span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">{room.name}</h2>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              {counts.online} online · {counts.giving} giving test · {counts.inRoom} in room · {counts.submitted} submitted
            </p>
          </div>

          <div className="flex items-center gap-3">
            {remaining != null && (
              <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-4 py-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-mono text-xl font-bold tracking-widest tabular-nums">{formatClock(remaining)}</span>
              </div>
            )}
            {!isClosed && (
              <Button variant="destructive" size="sm" disabled={closing} onClick={handleEndTest} className="gap-1.5 font-bold">
                {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                End room
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Join code — students join with this from their rooms section. */}
      {room.status === "lobby" && is_admin && (
        <RoomInviteCodeCard workspaceId={workspaceId} roomId={roomId} status={room.status} canManage={is_admin} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live student list */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> Live students
            </CardTitle>
            <CardDescription>
              Who is giving the test vs who is in the room but not giving it, updated live.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students yet. Share the room code so students can join from their rooms section.
              </p>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search students…"
                    className="pl-8"
                    aria-label="Search students"
                  />
                </div>
                {visible.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No students match “{query}”.</p>
                ) : (
              <ul className="divide-y rounded-md border">
                {visible.map((p) => {
                  const status = liveStatus(p, room.status, now);
                  const meta = STATUS_META[status];
                  return (
                    <li key={p.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.display_name}</p>
                          <p className={`text-[11px] font-semibold ${meta.badge}`}>{meta.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.role === "admin" ? <Badge variant="outline" className="text-xs">Admin</Badge> : null}
                        {p.score != null ? <Badge variant="secondary" className="text-xs">{p.score} pts</Badge> : null}
                        {p.role !== "admin" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title={`Remove ${p.display_name}`}
                            onClick={() => void handleKick(p.user_id, p.display_name)}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Live leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5 text-primary" /> Live leaderboard
            </CardTitle>
            <CardDescription>Ranked by score, then speed.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {leaderboard.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              leaderboard.map((p, idx) => (
                <div key={p.user_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        idx === 0 ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium">{p.display_name}</span>
                  </div>
                  <span className="font-bold text-primary">{p.score ?? 0} pts</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Post-test results: leaderboard + cumulated weak-topic radar + per-student
          drill-down — reuses the same analytics-service pipeline as the test
          section, keyed by the room's teacher test. */}
      {finished && teacherTestId && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary" /> Results &amp; analytics
              </CardTitle>
              <CardDescription>
                Leaderboard, weak topics cumulated across all students, and per-student analytics.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/teacher/workspaces/${workspaceId}/tests/${teacherTestId}`}>Full analytics</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <TestCohortAnalytics workspaceId={workspaceId} testId={teacherTestId} />
          </CardContent>
        </Card>
      )}

      {/* Live chat with typing indicator */}
      <LobbyChat
        messages={messages}
        locked={isClosed}
        currentUserId={currentUserId}
        onSend={sendChat}
        pendingMessages={pending}
        typingUsers={typingUsers}
        onTyping={sendTyping}
      />
    </div>
  );
}
