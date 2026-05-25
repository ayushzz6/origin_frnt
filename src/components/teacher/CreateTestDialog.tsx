"use client";

/**
 * Phase 5 — create-test wizard.
 *
 * Plan (05-implementation-roadmap.md §Phase 5) explicitly calls for a
 * "create test wizard" with title, schedule/duration/scoring controls,
 * and question-source picker (Question Bag / OGCode / mixed / random).
 * The tests page previously had a placeholder note "create-test wizard
 * is not yet built — POST to /api/.../tests to seed" — this fills the
 * gap with a multi-step dialog:
 *
 *   1. Basics — title, description, subject, chapter, difficulty,
 *      duration.
 *   2. Questions — pick from the workspace Question Bag (only
 *      questions in `ready` / `published_private` state are eligible
 *      per Phase 4 plan rules). Per-row marks + negative marks
 *      defaults from the schema (4 / -1).
 *   3. Review + submit.
 *
 * Random selection and OGCode mixing are reachable through the
 * existing /api/teacher/.../tests POST body (selectionPolicy /
 * sourceBank=ogcode); the wizard exposes the common case (manual pick
 * from Question Bag) and stays out of the way for power users who
 * want to POST directly.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/teacher-client";
import type { QuestionWithVersion } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
};

type PickedQuestion = {
  questionId: string;
  versionId: string;
  stem: string;
  questionType: string;
  marks: number;
  negativeMarks: number;
};

const DIFFICULTIES = ["easy", "medium", "hard", "insane"] as const;

export function CreateTestDialog({ workspaceId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Basics
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("mixed");
  const [chapter, setChapter] = useState("");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]>("medium");
  const [durationMinutes, setDurationMinutes] = useState("60");

  // Question pool
  const [pool, setPool] = useState<QuestionWithVersion[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<PickedQuestion[]>([]);

  // Submit
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || step !== 2) return;
    let cancelled = false;
    setPoolLoading(true);
    setPoolError(null);
    (async () => {
      const result = await apiJson<{ questions: QuestionWithVersion[] }>(
        `/api/teacher/workspaces/${workspaceId}/questions?status=ready`,
      );
      if (cancelled) return;
      if (!result.ok) {
        setPoolError(result.detail);
      } else {
        setPool(result.data.questions);
      }
      setPoolLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, workspaceId]);

  function resetWizard() {
    setStep(1);
    setTitle("");
    setDescription("");
    setSubject("mixed");
    setChapter("");
    setDifficulty("medium");
    setDurationMinutes("60");
    setPool([]);
    setPicked([]);
    setSubmitError(null);
    setSearch("");
  }

  function togglePick(q: QuestionWithVersion) {
    if (!q.currentVersion) return;
    setPicked((prev) => {
      const idx = prev.findIndex((p) => p.questionId === q.id);
      if (idx >= 0) {
        return prev.filter((p) => p.questionId !== q.id);
      }
      return [
        ...prev,
        {
          questionId: q.id,
          versionId: q.currentVersion!.id,
          stem: q.currentVersion!.stem,
          questionType: q.currentVersion!.questionType,
          marks: 4,
          negativeMarks: -1,
        },
      ];
    });
  }

  function updatePickedMarks(questionId: string, key: "marks" | "negativeMarks", value: number) {
    setPicked((prev) =>
      prev.map((p) => (p.questionId === questionId ? { ...p, [key]: value } : p)),
    );
  }

  function basicsValid() {
    return title.trim().length >= 1 && Number(durationMinutes) > 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    if (!basicsValid()) {
      setSubmitError("Title and duration are required.");
      return;
    }
    if (picked.length === 0) {
      setSubmitError("Pick at least one question.");
      return;
    }
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      subject,
      chapter: chapter.trim() || undefined,
      difficulty,
      durationMinutes: Number(durationMinutes),
      questions: picked.map((p, i) => ({
        position: i + 1,
        sourceBank: "workspace_bag" as const,
        contentQuestionId: p.questionId,
        contentQuestionVersionId: p.versionId,
        marks: p.marks,
        negativeMarks: p.negativeMarks,
      })),
    };
    const result = await apiJson<{ test: { id: string } }>(
      `/api/teacher/workspaces/${workspaceId}/tests`,
      { method: "POST", json: body },
    );
    if (!result.ok) {
      setSubmitError(result.detail);
      return;
    }
    setOpen(false);
    resetWizard();
    router.refresh();
  }

  const filteredPool = pool.filter((q) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      q.currentVersion?.stem.toLowerCase().includes(needle) ||
      q.currentVersion?.subject.toLowerCase().includes(needle) ||
      q.currentVersion?.chapter.toLowerCase().includes(needle)
    );
  });

  const totalMarks = picked.reduce((sum, p) => sum + p.marks, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetWizard();
      }}
    >
      <Button onClick={() => setOpen(true)}>Create test</Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create test — step {step} of 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Basics — title, subject, duration."}
            {step === 2 && "Pick questions from the workspace Question Bag."}
            {step === 3 && "Review and create."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {step === 1 ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="t-title">Title</Label>
                <Input
                  id="t-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="JEE Mains — Mechanics weekly"
                  required
                />
              </div>
              <div>
                <Label htmlFor="t-desc">Description (optional)</Label>
                <Textarea
                  id="t-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="t-subject">Subject</Label>
                  <Input
                    id="t-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="physics / mixed / ..."
                  />
                </div>
                <div>
                  <Label htmlFor="t-chapter">Chapter (optional)</Label>
                  <Input
                    id="t-chapter"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    placeholder="Kinematics"
                  />
                </div>
                <div>
                  <Label htmlFor="t-difficulty">Difficulty</Label>
                  <Select
                    value={difficulty}
                    onValueChange={(v) =>
                      setDifficulty(v as (typeof DIFFICULTIES)[number])
                    }
                  >
                    <SelectTrigger id="t-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="t-duration">Duration (minutes)</Label>
                  <Input
                    id="t-duration"
                    type="number"
                    min={1}
                    max={300}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <Input
                placeholder="Search question text, subject, chapter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {poolLoading ? (
                <p className="text-sm text-muted-foreground">Loading questions…</p>
              ) : poolError ? (
                <p className="text-sm text-destructive">{poolError}</p>
              ) : filteredPool.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No <code className="text-xs">ready</code> questions in this
                  workspace yet. Add or publish questions in the Question Bag
                  first.
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1.5">
                  {filteredPool.map((q) => {
                    const isPicked = picked.some((p) => p.questionId === q.id);
                    return (
                      <button
                        type="button"
                        key={q.id}
                        onClick={() => togglePick(q)}
                        className={`flex w-full items-start gap-2 rounded p-2 text-left text-sm transition hover:bg-muted ${
                          isPicked ? "bg-primary/10" : ""
                        }`}
                      >
                        <Badge variant={isPicked ? "default" : "outline"}>
                          {isPicked ? "✓" : "+"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {q.currentVersion?.stem ?? "(no stem)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {q.currentVersion?.subject} · {q.currentVersion?.chapter} ·{" "}
                            {q.currentVersion?.questionType}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {picked.length} selected
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Title</p>
                  <p className="font-medium">{title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Subject</p>
                  <p>{subject}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Duration</p>
                  <p>{durationMinutes} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Questions</p>
                  <p>
                    {picked.length} · {totalMarks} marks total
                  </p>
                </div>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                {picked.map((p, i) => (
                  <div key={p.questionId} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1 truncate">{p.stem}</span>
                    <Input
                      className="h-7 w-14"
                      type="number"
                      value={p.marks}
                      onChange={(e) =>
                        updatePickedMarks(p.questionId, "marks", Number(e.target.value))
                      }
                      title="Marks"
                    />
                    <Input
                      className="h-7 w-14"
                      type="number"
                      value={p.negativeMarks}
                      onChange={(e) =>
                        updatePickedMarks(
                          p.questionId,
                          "negativeMarks",
                          Number(e.target.value),
                        )
                      }
                      title="Negative marks"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              >
                Back
              </Button>
            ) : null}
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                disabled={step === 1 ? !basicsValid() : picked.length === 0}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={pending || !basicsValid() || picked.length === 0}
                onClick={(e) => {
                  e.preventDefault();
                  startTransition(() => submit(e as unknown as FormEvent));
                }}
              >
                {pending ? "Creating…" : "Create test"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
