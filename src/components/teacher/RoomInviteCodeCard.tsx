"use client";

/**
 * Phase 6 — invite code card.
 *
 * Surfaces the room's currently-active 6-character invite code (if
 * any) and lets the room admin regenerate one. Reuses the legacy
 * /study-rooms code helpers via the new
 * /api/teacher/workspaces/[id]/rooms/[id]/code wrapper, so the join
 * flow that students already use through /api/study-rooms/join still
 * works unchanged.
 */

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherRoomSummary } from "@/server/workspaces/types";

type InviteCode = {
  code: string;
  ttl_seconds: number;
  expires_at: string;
};

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
  canManage: boolean;
};

export function RoomInviteCodeCard({ workspaceId, room, canManage }: Props) {
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiJson<{ inviteCode: InviteCode | null }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/code`,
      );
      if (cancelled) return;
      if (result.ok) setInviteCode(result.data.inviteCode);
      else if (result.status !== 404) setError(result.detail);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, room.id]);

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await apiJson<{ inviteCode: InviteCode }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/code`,
        { method: "POST" },
      );
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
      // Clipboard permission denied — silent fallback, user can read the code.
    }
  }

  const expiresAt = inviteCode ? new Date(inviteCode.expires_at) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {inviteCode ? (
          <p className="font-mono text-2xl font-semibold tracking-[0.4em]">
            {inviteCode.code}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active invite code.
          </p>
        )}
        {inviteCode ? (
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      {expiresAt ? (
        <p className="text-xs text-muted-foreground">
          Expires {expiresAt.toLocaleString()}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {canManage && room.status === "lobby" ? (
        <Button
          size="sm"
          variant={inviteCode ? "outline" : "default"}
          disabled={pending}
          onClick={regenerate}
        >
          {pending
            ? "Generating…"
            : inviteCode
              ? "Regenerate code"
              : "Generate invite code"}
        </Button>
      ) : null}
    </div>
  );
}
