"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { csrfHeaders } from "@/lib/csrf";
import type { WorkspaceStatus } from "@/server/workspaces/types";

type Props =
  | {
      workspaceId: string;
      currentStatus: WorkspaceStatus;
      mode?: "workspace";
    }
  | {
      workspaceId: string;
      currentStatus: WorkspaceStatus;
      mode: "revoke-code";
      codeId: string;
      codeLabel: string;
    };

export function AdminWorkspaceActions(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (props.mode === "revoke-code") {
    return (
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const ok = window.confirm(
              `Revoke code "${props.codeLabel}"? This is immediate and audited.`,
            );
            if (!ok) return;
            const res = await fetch(
              `/api/admin/workspaces/${props.workspaceId}/codes/${props.codeId}/revoke`,
              { method: "POST", headers: csrfHeaders(), credentials: "include" },
            );
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as {
                detail?: string;
              };
              setError(data.detail ?? `Revoke failed (${res.status})`);
              return;
            }
            router.refresh();
          })
        }
      >
        {isPending ? "…" : "Revoke"}
      </Button>
    );
  }

  async function callAction(action: "suspend" | "unsuspend" | "close") {
    const promptLabels: Record<typeof action, string> = {
      suspend: "Suspend this workspace? Non-admin members will lose write access.",
      unsuspend: "Reactivate this workspace?",
      close: "Permanently close this workspace? This is hard to reverse.",
    } as const;
    const ok = window.confirm(promptLabels[action]);
    if (!ok) return;

    const res = await fetch(`/api/admin/workspaces/${props.workspaceId}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...csrfHeaders() },
      credentials: "include",
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? `Action failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {props.currentStatus !== "suspended" && props.currentStatus !== "closed" ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => callAction("suspend"))}
        >
          Suspend
        </Button>
      ) : null}
      {props.currentStatus === "suspended" ? (
        <Button
          variant="default"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => callAction("unsuspend"))}
        >
          Unsuspend
        </Button>
      ) : null}
      {props.currentStatus !== "closed" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => callAction("close"))}
        >
          Close workspace
        </Button>
      ) : null}
      {error ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
