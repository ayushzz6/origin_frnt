"use client";

/**
 * Phase 13 — client-side incident control forms.
 *
 * Each form posts to /api/admin/incidents/<action>. On success, the
 * server-rendered shell is reloaded so the snapshot at the top of the
 * page reflects the change.
 */

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";

import type { RateLimitMode } from "@/server/incidents";

const RATE_LIMIT_MODES: RateLimitMode[] = ["relaxed", "normal", "strict", "lockdown"];

function useIncidentMutator() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (path: string, json: unknown) => {
    start(async () => {
      setError(null);
      const result = await apiJson<{ ok: boolean }>(path, { method: "POST", json });
      if (!result.ok) {
        setError(result.detail);
        return;
      }
      window.location.reload();
    });
  };

  return { pending, error, run };
}

function RateLimit({ current }: { current: RateLimitMode }) {
  const { pending, error, run } = useIncidentMutator();
  const [mode, setMode] = useState<RateLimitMode>(current);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {RATE_LIMIT_MODES.map((m) => (
          <Button
            key={m}
            type="button"
            variant={mode === m ? "default" : "outline"}
            onClick={() => setMode(m)}
            disabled={pending}
          >
            {m}
          </Button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Reason (logged in audit event)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button
        type="button"
        onClick={() => run("/api/admin/incidents/rate_limit", { mode, reason: reason || null })}
        disabled={pending || mode === current}
      >
        {pending ? "Applying…" : `Set mode to ${mode}`}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function KillSwitch({ flag, current }: { flag: string; current: boolean | undefined }) {
  const { pending, error, run } = useIncidentMutator();
  const [reason, setReason] = useState("");

  const buttons: Array<{ label: string; value: "on" | "off" | "clear"; variant: "default" | "destructive" | "outline" }> = [
    { label: "Force on", value: "on", variant: "default" },
    { label: "Kill", value: "off", variant: "destructive" },
    { label: "Clear", value: "clear", variant: "outline" },
  ];

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1">
        {buttons.map((b) => (
          <Button
            key={b.value}
            size="sm"
            variant={b.variant}
            onClick={() => run(`/api/admin/incidents/kill_switch`, { flag, value: b.value, reason: reason || null })}
            disabled={pending || (b.value === "clear" && current === undefined)}
          >
            {b.label}
          </Button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-48 rounded-md border bg-background px-2 py-1 text-xs"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ForceLogout() {
  const { pending, error, run } = useIncidentMutator();
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="user id"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <input
        type="text"
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button
        type="button"
        variant="destructive"
        onClick={() =>
          run("/api/admin/incidents/force_logout", { userId, reason: reason || null })
        }
        disabled={pending || !userId}
      >
        {pending ? "Logging out…" : "Force logout"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function CloseWorkspace() {
  const { pending, error, run } = useIncidentMutator();
  const [workspaceId, setWorkspaceId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="workspace id"
        value={workspaceId}
        onChange={(e) => setWorkspaceId(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <input
        type="text"
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button
        type="button"
        variant="destructive"
        onClick={() =>
          run("/api/admin/incidents/close_workspace", { workspaceId, reason: reason || null })
        }
        disabled={pending || !workspaceId}
      >
        {pending ? "Closing…" : "Close workspace"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export const IncidentControlForms = {
  RateLimit,
  KillSwitch,
  ForceLogout,
  CloseWorkspace,
};
