"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiJson } from "@/lib/teacher-client";
import type { BatchMember, EnrollmentWithStudent } from "@/server/workspaces/types";

type Member = BatchMember & { studentName: string | null; studentEmail: string | null };

type Props = {
  workspaceId: string;
  batchId: string;
  members: Member[];
  candidates: EnrollmentWithStudent[];
  canManage: boolean;
};

export function BatchRosterManager({
  workspaceId,
  batchId,
  members,
  candidates,
  canManage,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showAdder, setShowAdder] = useState(false);

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setError(null);
    const result = await apiJson(
      `/api/teacher/workspaces/${workspaceId}/batches/${batchId}/students`,
      {
        method: "POST",
        json: { studentIds: Array.from(selected) },
      },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setSelected(new Set());
    setShowAdder(false);
    location.reload();
  }

  async function removeMember(studentId: string) {
    setError(null);
    const result = await apiJson(
      `/api/teacher/workspaces/${workspaceId}/students/${studentId}/assign-batches`,
      {
        method: "POST",
        json: { remove: [batchId] },
      },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    location.reload();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students assigned yet.</p>
      ) : (
        <ul className="divide-y">
          {members.map((member) => (
            <li key={member.studentId} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">
                  {member.studentName ?? member.studentId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.studentEmail ?? "—"} · assigned{" "}
                  {new Date(member.assignedAt).toLocaleDateString()}
                </p>
              </div>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => startTransition(() => void removeMember(member.studentId))}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="space-y-2 border-t pt-4">
          {showAdder ? (
            <>
              <p className="text-sm font-medium">Add students</p>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No more students available. Enroll new students with your join code first.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {candidates.map((candidate) => (
                    <label
                      key={candidate.studentId}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        checked={selected.has(candidate.studentId)}
                        onCheckedChange={() => toggle(candidate.studentId)}
                      />
                      <span className="text-sm">
                        {candidate.studentName ?? candidate.studentId}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {candidate.status}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAdder(false);
                    setSelected(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={pending || selected.size === 0}
                  onClick={() => startTransition(() => void addSelected())}
                >
                  {pending ? "Adding…" : `Add ${selected.size}`}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" onClick={() => setShowAdder(true)}>
              Add students
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
