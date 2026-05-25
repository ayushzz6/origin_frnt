"use client";

import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { csrfHeaders } from "@/lib/csrf";
import type {
  ImportJobQuestion,
  ImportQuestionStatus,
} from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  jobId: string;
  initialQuestions: ImportJobQuestion[];
};

type Filter =
  | "all"
  | "review_required"
  | "missing_answer"
  | "missing_diagram"
  | "low_confidence"
  | "accepted"
  | "rejected";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  review_required: "Needs review",
  missing_answer: "Missing answer",
  missing_diagram: "Missing diagram",
  low_confidence: "Low confidence",
  accepted: "Accepted",
  rejected: "Rejected",
};

const STATUS_VARIANT: Record<
  ImportQuestionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  review_required: "secondary",
  accepted: "default",
  rejected: "destructive",
  published: "default",
};

function matchesFilter(q: ImportJobQuestion, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "review_required":
      return q.status === "review_required";
    case "missing_answer":
      return (
        q.status === "review_required" &&
        q.correctOption === null &&
        !q.correctOptions &&
        !q.answerText
      );
    case "missing_diagram":
      return q.hasDiagram === true;
    case "low_confidence":
      return (q.confidenceScore ?? 0) < 0.5;
    case "accepted":
      return q.status === "accepted";
    case "rejected":
      return q.status === "rejected";
    default:
      return true;
  }
}

export function ImportReviewBoard({
  workspaceId,
  jobId,
  initialQuestions,
}: Props) {
  const [questions, setQuestions] =
    useState<ImportJobQuestion[]>(initialQuestions);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [partialOpen, setPartialOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = useMemo(() => {
    return questions.filter((q) => {
      if (!matchesFilter(q, filter)) return false;
      if (search.trim()) {
        return (q.questionText ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());
      }
      return true;
    });
  }, [questions, filter, search]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(visible.map((q) => q.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkAccept(ids: string[]) {
    setActionError(null);
    const res = await fetch(
      `/api/teacher/workspaces/${workspaceId}/import-jobs/${jobId}?action=bulk-accept`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ questionIds: ids }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(data.detail ?? `Bulk-accept failed (${res.status})`);
    }
    setQuestions((prev) =>
      prev.map((q) =>
        ids.includes(q.id) ? { ...q, status: "accepted" as const } : q,
      ),
    );
    clearSelection();
  }

  async function reviewOne(
    id: string,
    action: "accept" | "reject",
    rejectionReason?: string,
  ) {
    setActionError(null);
    const res = await fetch(
      `/api/teacher/workspaces/${workspaceId}/import-jobs/${jobId}?action=review-question`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({
          action,
          questionId: id,
          rejectionReason,
        }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(data.detail ?? `Review failed (${res.status})`);
    }
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              status: action === "accept" ? "accepted" : "rejected",
              rejectionReason: rejectionReason ?? q.rejectionReason,
            }
          : q,
      ),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {FILTER_LABEL[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question text…"
            className="max-w-sm"
          />
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllVisible}
            disabled={visible.length === 0}
          >
            Select visible ({visible.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            disabled={selected.size === 0}
          >
            Clear
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await bulkAccept(Array.from(selected));
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : String(err),
                  );
                }
              })
            }
          >
            Accept selected ({selected.size})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!questions.some((q) => q.status === "review_required")}
            onClick={() => setPartialOpen(true)}
          >
            Accept partial…
          </Button>
        </div>

        {actionError ? (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}

        <div className="space-y-3">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions match this filter.
            </p>
          ) : (
            visible.map((q) => (
              <div
                key={q.id}
                className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2"
              >
                {/* Left: question */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.has(q.id)}
                      onCheckedChange={() => toggleSelect(q.id)}
                      disabled={q.status !== "review_required"}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[q.status]}>
                          {q.status}
                        </Badge>
                        {q.confidenceScore != null ? (
                          <span className="text-xs text-muted-foreground">
                            conf: {(q.confidenceScore * 100).toFixed(0)}%
                          </span>
                        ) : null}
                        {q.questionType ? (
                          <span className="text-xs uppercase text-muted-foreground">
                            {q.questionType}
                          </span>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">
                        {q.questionText ?? "(empty stem)"}
                      </p>
                      {q.options ? (
                        <ol className="ml-4 list-decimal text-sm text-muted-foreground">
                          {Array.isArray(q.options)
                            ? (q.options as Array<{ text?: string }>).map(
                                (opt, i) => (
                                  <li key={i}>{opt.text ?? ""}</li>
                                ),
                              )
                            : null}
                        </ol>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={
                        q.status === "accepted" ||
                        q.status === "published" ||
                        isPending
                      }
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await reviewOne(q.id, "accept");
                          } catch (err) {
                            setActionError(
                              err instanceof Error
                                ? err.message
                                : String(err),
                            );
                          }
                        })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={
                        q.status === "rejected" ||
                        q.status === "published" ||
                        isPending
                      }
                      onClick={() =>
                        startTransition(async () => {
                          const reason = window.prompt(
                            "Reason for rejecting this question?",
                            "",
                          );
                          if (reason === null) return;
                          try {
                            await reviewOne(q.id, "reject", reason || undefined);
                          } catch (err) {
                            setActionError(
                              err instanceof Error
                                ? err.message
                                : String(err),
                            );
                          }
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>

                {/* Right: source evidence */}
                <div className="rounded-md bg-muted/30 p-3 text-xs">
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Source evidence
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Page {q.pageId ? "—" : "(page id missing)"}
                    {q.hasDiagram ? " · diagram referenced" : ""}
                  </p>
                  {q.diagramDescription ? (
                    <p className="mt-2 italic">{q.diagramDescription}</p>
                  ) : null}
                  {(q.metadata as Record<string, unknown> | undefined)
                    ?.source_snippet ? (
                    <pre className="mt-2 whitespace-pre-wrap text-[10px] text-muted-foreground">
                      {String(
                        (q.metadata as Record<string, unknown>).source_snippet,
                      )}
                    </pre>
                  ) : null}
                  {Array.isArray(
                    (q.metadata as Record<string, unknown> | undefined)
                      ?.review_reasons,
                  ) ? (
                    <ul className="mt-2 list-disc pl-4 text-amber-600">
                      {(
                        (q.metadata as Record<string, unknown>).review_reasons as string[]
                      ).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {q.rejectionReason ? (
                    <p className="mt-2 text-destructive">
                      Rejected: {q.rejectionReason}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <Dialog open={partialOpen} onOpenChange={setPartialOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accept all review-required questions?</DialogTitle>
              <DialogDescription>
                This accepts every question currently marked
                <strong> review_required</strong>, including ones with
                low confidence or known issues. You can still edit them
                later, but they will be available for use in tests.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPartialOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const ids = questions
                        .filter((q) => q.status === "review_required")
                        .map((q) => q.id);
                      await bulkAccept(ids);
                      setPartialOpen(false);
                    } catch (err) {
                      setActionError(
                        err instanceof Error ? err.message : String(err),
                      );
                    }
                  })
                }
              >
                Yes, accept all
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
