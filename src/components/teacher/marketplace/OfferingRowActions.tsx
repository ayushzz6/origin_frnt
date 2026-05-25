"use client";

/**
 * Phase 12 — per-offering row actions (archive / activate / pause).
 *
 * The offerings list previously only had a "Preview" link; teachers
 * had no way to take a draft offering live, pause it, or archive an
 * old one — even though the PATCH /offerings/[id] endpoint already
 * supports status transitions. This island wires the UI to that API.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";

type OfferingStatus = "draft" | "active" | "paused" | "archived";

type Props = {
  workspaceId: string;
  offeringId: string;
  status: OfferingStatus;
};

export function OfferingRowActions({ workspaceId, offeringId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: OfferingStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    const result = await apiJson(
      `/api/teacher/workspaces/${workspaceId}/offerings/${offeringId}`,
      { method: "PATCH", json: { status: next } },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "draft" || status === "paused" ? (
        <Button
          size="sm"
          variant="default"
          disabled={pending}
          onClick={() => startTransition(() => setStatus("active"))}
        >
          {status === "draft" ? "Activate" : "Resume"}
        </Button>
      ) : null}

      {status === "active" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              setStatus(
                "paused",
                "Pause this offering? Students won't see it on the marketplace until you resume.",
              ),
            )
          }
        >
          Pause
        </Button>
      ) : null}

      {status !== "archived" ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              setStatus(
                "archived",
                "Archive this offering? Existing paid orders stay valid but the listing disappears from the marketplace. This is reversible.",
              ),
            )
          }
        >
          Archive
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => setStatus("draft"))}
        >
          Unarchive
        </Button>
      )}

      {error ? (
        <p className="basis-full text-right text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
