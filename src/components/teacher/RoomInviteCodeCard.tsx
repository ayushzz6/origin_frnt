"use client";

/**
 * Teacher Live Rooms — join code card.
 *
 * Shows the room's current 6-character join code and, in rotating mode, a live
 * "new code in Ns" countdown that auto-fetches the next 60s code at rollover
 * (strict cutover — the old code stops working immediately). The admin can flip
 * the room to a permanent (non-expiring) single code, or manually regenerate.
 * Students join with this code from their rooms section via /api/study-rooms/join.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Copy, Check, RefreshCw, Timer, Infinity as InfinityIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";

type CodeMode = "rotating" | "permanent";

type InviteCode = {
  code: string;
  ttl_seconds: number;
  expires_at: string;
  mode?: CodeMode;
};

type Props = {
  workspaceId: string;
  roomId: string;
  status: string;
  canManage: boolean;
};

export function RoomInviteCodeCard({ workspaceId, roomId, status, canManage }: Props) {
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const codeUrl = `/api/teacher/workspaces/${workspaceId}/rooms/${roomId}/code`;

  const load = useCallback(async () => {
    const result = await apiJson<{ inviteCode: InviteCode | null }>(codeUrl);
    if (result.ok) {
      setInviteCode(result.data.inviteCode);
      setError(null);
    } else if (result.status !== 404) {
      setError(result.detail);
    }
  }, [codeUrl]);

  // Initial fetch.
  useEffect(() => {
    void load();
  }, [load]);

  // 1s tick for the rotation countdown.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fetch the next code exactly when the rotating one expires.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    if (!inviteCode || inviteCode.mode === "permanent" || status !== "lobby") return;
    const ms = new Date(inviteCode.expires_at).getTime() - Date.now();
    refetchTimerRef.current = setTimeout(() => void load(), Math.max(0, ms) + 400);
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [inviteCode, status, load]);

  function regenerate(mode?: CodeMode) {
    setError(null);
    startTransition(async () => {
      const result = await apiJson<{ inviteCode: InviteCode }>(codeUrl, {
        method: "POST",
        body: mode ? JSON.stringify({ mode }) : undefined,
      });
      if (!result.ok) {
        setError(result.detail);
        return;
      }
      setInviteCode(result.data.inviteCode);
    });
  }

  async function copy() {
    if (!inviteCode || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(inviteCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the code is still visible to read out.
    }
  }

  const isPermanent = inviteCode?.mode === "permanent";
  const remaining = inviteCode && !isPermanent
    ? Math.max(0, Math.ceil((new Date(inviteCode.expires_at).getTime() - now) / 1000))
    : null;
  const manageable = canManage && status === "lobby";

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Join code</p>
        {inviteCode ? (
          isPermanent ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
              <InfinityIcon className="h-3.5 w-3.5" /> Permanent
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-primary tabular-nums">
              <Timer className="h-3.5 w-3.5" /> New code in {remaining}s
            </span>
          )
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        {inviteCode ? (
          <p className="font-mono text-3xl font-bold tracking-[0.35em]">{inviteCode.code}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status === "lobby" ? "Generating join code…" : "Joins are closed for this room."}
          </p>
        )}
        {inviteCode ? (
          <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>

      {/* Rotation progress bar */}
      {inviteCode && !isPermanent && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.min(100, ((remaining ?? 0) / 60) * 100)}%` }}
          />
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {manageable ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Mode toggle */}
          <div className="inline-flex overflow-hidden rounded-lg border text-xs">
            <button
              type="button"
              disabled={pending}
              onClick={() => regenerate("rotating")}
              className={`px-2.5 py-1 font-semibold ${!isPermanent ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Rotating 60s
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => regenerate("permanent")}
              className={`px-2.5 py-1 font-semibold ${isPermanent ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Permanent
            </button>
          </div>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => regenerate()} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> New code
          </Button>
        </div>
      ) : null}
    </div>
  );
}
