"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { csrfHeaders } from "@/lib/csrf";

type Props = {
  publicationId: string;
};

export function AdminModerationActions({ publicationId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function approve(publish: boolean) {
    const res = await fetch(
      `/api/admin/ogcode/moderation/${publicationId}/approve`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ publish }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? `Approve failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  async function reject(mode: "reject" | "request_changes") {
    const notes = window.prompt(
      mode === "reject"
        ? "Optional notes for the rejection:"
        : "What changes do you need? (required)",
      "",
    );
    if (notes === null) return;
    if (mode === "request_changes" && !notes.trim()) {
      setError("Notes are required when requesting changes.");
      return;
    }
    const res = await fetch(
      `/api/admin/ogcode/moderation/${publicationId}/reject`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ mode, notes: notes || null }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? `Reject failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        size="sm"
        variant="default"
        disabled={isPending}
        onClick={() => startTransition(() => approve(false))}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="default"
        disabled={isPending}
        onClick={() => startTransition(() => approve(true))}
      >
        Publish now
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => startTransition(() => reject("request_changes"))}
      >
        Request changes
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => startTransition(() => reject("reject"))}
      >
        Reject
      </Button>
      {error ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
