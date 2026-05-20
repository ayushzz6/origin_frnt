"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiJson } from "@/lib/teacher-client";
import type { BatchWithCounts, EnrollmentWithStudent } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  students: EnrollmentWithStudent[];
  batches: BatchWithCounts[];
  emptyLabel: string;
  readOnly?: boolean;
};

export function StudentsManager({
  workspaceId,
  students,
  batches,
  emptyLabel,
  readOnly,
}: Props) {
  const [assigning, setAssigning] = useState<EnrollmentWithStudent | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());

  if (students.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  function toggleBatch(batchId: string) {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  async function confirmAssign() {
    if (!assigning || selectedBatches.size === 0) return;
    setError(null);
    const result = await apiJson(
      `/api/teacher/workspaces/${workspaceId}/students/${assigning.studentId}/assign-batches`,
      {
        method: "POST",
        json: { add: Array.from(selectedBatches) },
      },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setAssigning(null);
    setSelectedBatches(new Set());
    location.reload();
  }

  async function suspend(student: EnrollmentWithStudent) {
    setError(null);
    const result = await apiJson(
      `/api/teacher/workspaces/${workspaceId}/students/${student.studentId}`,
      { method: "PATCH", json: { status: "suspended" } },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    location.reload();
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y">
        {students.map((student) => (
          <li key={student.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium">{student.studentName ?? student.studentId}</p>
              <p className="text-xs text-muted-foreground">
                {student.studentEmail ?? "—"} · enrolled {new Date(student.enrolledAt).toLocaleDateString()} · {student.status}
              </p>
            </div>
            {readOnly ? null : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAssigning(student);
                    setSelectedBatches(new Set());
                  }}
                  disabled={batches.length === 0}
                >
                  Assign to batches
                </Button>
                {student.status !== "suspended" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => startTransition(() => void suspend(student))}
                  >
                    Suspend
                  </Button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to batches</DialogTitle>
            <DialogDescription>
              {assigning?.studentName ?? assigning?.studentId} will get access to the selected batches.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active batches yet. Create one first.</p>
            ) : (
              batches.map((batch) => (
                <label key={batch.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox
                    checked={selectedBatches.has(batch.id)}
                    onCheckedChange={() => toggleBatch(batch.id)}
                  />
                  <span className="text-sm font-medium">{batch.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {batch.studentCount} students
                  </span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending || selectedBatches.size === 0}
              onClick={() => startTransition(() => void confirmAssign())}
            >
              {pending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
