"use client";

/**
 * Phase 15 — build a test in place for a teacher room.
 *
 * Reuses the shared QuestionPicker (mix OG Code + Question Bag). On submit it
 * creates a draft teacher test and immediately attaches it to the room via the
 * existing configure-test route — zero new backend. The take/grade path resolves
 * mixed sources (Phase 0), so the room runs the test correctly.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  QuestionWithVersion,
  TeacherRoomSummary,
} from "@/server/workspaces/types";
import { toast } from "sonner";

import { QuestionPicker, type SelectedQuestion } from "./QuestionPicker";

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
  bagQuestions: QuestionWithVersion[];
  ogcodeEnabled: boolean;
};

export function RoomTestBuilderDrawer({ workspaceId, room, bagQuestions, ogcodeEnabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState<SelectedQuestion[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = room.status !== "lobby";

  function submit() {
    if (!title.trim()) {
      toast.error("Test title is required.");
      return;
    }
    if (questions.length === 0) {
      toast.error("Add at least one question.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const created = await apiJson<{ test: AssessmentTest }>(
        `/api/teacher/workspaces/${workspaceId}/tests`,
        {
          method: "POST",
          json: {
            title: title.trim(),
            subject: subject.trim() || "mixed",
            difficulty,
            durationMinutes: Number(duration),
            questions: questions.map((q, idx) => ({
              position: idx + 1,
              sourceBank: q.sourceBank,
              ogcodeQuestionId: q.sourceBank === "ogcode" ? q.id : null,
              contentQuestionId: q.sourceBank === "workspace_bag" ? q.id : null,
              marks: q.marks,
              negativeMarks: q.negativeMarks,
            })),
          },
        },
      );
      if (!created.ok) {
        setError(created.detail);
        return;
      }
      const attach = await apiJson<{ room: TeacherRoomSummary }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/configure-test`,
        { method: "POST", json: { teacherTestId: created.data.test.id } },
      );
      if (!attach.ok) {
        setError(attach.detail);
        return;
      }
      toast.success("Room test built and attached!");
      setOpen(false);
      setTitle("");
      setQuestions([]);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button disabled={disabled}>
          {room.teacherTestId ? "Build new test" : "Build test for room"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Build a test for this room</SheetTitle>
          <SheetDescription>
            Mix OG Code and your Question Bag. The test is created and attached to this room in
            one step.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Rapid Fire — Electrostatics"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Physics"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="insane">Insane</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>

          <QuestionPicker
            value={questions}
            onChange={setQuestions}
            workspaceId={workspaceId}
            bagQuestions={bagQuestions}
            ogcodeEnabled={ogcodeEnabled}
          />

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <SheetFooter className="gap-2">
          <Button onClick={submit} disabled={pending || disabled}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Build &amp; attach
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
