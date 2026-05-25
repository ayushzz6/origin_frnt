"use client";

/**
 * Phase 6 — configure-test drawer for a teacher room.
 *
 * Lists the workspace's existing draft/scheduled/published tests and
 * lets the room admin link one to this room. The actual question
 * source (Question Bag / OGCode / mixed / random / weak topics) is
 * already encoded inside the test itself, so this drawer only has to
 * pick which test to attach. Clearing the selection PATCHes
 * `teacherTestId: null`.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { apiJson } from "@/lib/teacher-client";
import type {
  AssessmentTest,
  TeacherRoomSummary,
} from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
};

const ELIGIBLE_STATUSES: AssessmentTest["status"][] = [
  "draft",
  "scheduled",
  "published",
];

export function RoomConfigureTestDrawer({ workspaceId, room }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tests, setTests] = useState<AssessmentTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const result = await apiJson<{ tests: AssessmentTest[] }>(
        `/api/teacher/workspaces/${workspaceId}/tests`,
      );
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setTests(
          (result.data.tests ?? []).filter((t) =>
            ELIGIBLE_STATUSES.includes(t.status),
          ),
        );
      } else {
        setError(result.detail);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  const visible = tests.filter((t) =>
    search.trim()
      ? t.title.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  function attach(testId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await apiJson<{ room: TeacherRoomSummary }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/configure-test`,
        { method: "POST", json: { teacherTestId: testId } },
      );
      if (!result.ok) {
        setError(result.detail);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const disabled = room.status !== "lobby";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={room.teacherTestId ? "outline" : "default"} disabled={disabled}>
          {room.teacherTestId ? "Change test" : "Configure test"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Configure room test</SheetTitle>
          <SheetDescription>
            Pick one of your workspace tests to run in this room. Tests
            that are already scheduled or published are eligible — and
            so are drafts you intend to launch live.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 py-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tests…"
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading tests…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible tests yet. Create one from the Tests tab first.
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((test) => {
                const isSelected = room.teacherTestId === test.id;
                return (
                  <li key={test.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => attach(test.id)}
                      className={`w-full rounded-md border p-3 text-left transition hover:border-primary/40 hover:bg-accent ${isSelected ? "border-primary bg-accent" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {test.title}
                        </span>
                        <Badge variant="outline" className="text-xs uppercase">
                          {test.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {test.subject} · {test.totalQuestions} questions ·{" "}
                        {test.durationMinutes} min · source: {test.source}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <SheetFooter className="gap-2">
          {room.teacherTestId ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => attach(null)}
            >
              Detach test
            </Button>
          ) : null}
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
