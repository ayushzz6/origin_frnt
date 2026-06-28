'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export function InviteCodeCard({
  inviteCode,
  isAdmin,
  onRegenerate,
}: {
  inviteCode: { code: string; expires_at: string; ttl_seconds: number } | null;
  isAdmin: boolean;
  onRegenerate: () => Promise<void>;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const secondsRemaining = useMemo(() => {
    if (!inviteCode) return 0;
    if (now === null) return Math.max(0, inviteCode.ttl_seconds);
    return Math.max(0, Math.ceil((new Date(inviteCode.expires_at).getTime() - now) / 1000));
  }, [inviteCode, now]);

  const pct = inviteCode && inviteCode.ttl_seconds > 0
    ? secondsRemaining / inviteCode.ttl_seconds
    : 0;

  const copyCode = async (): Promise<void> => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode.code);
    toast.success('Invite code copied.');
  };

  const regenerate = async (): Promise<void> => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
      toast.success('New invite code generated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not regenerate code.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const isExpired = secondsRemaining <= 0;

  return (
    <section className="neu-raised rounded-2xl p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Invite Code</h2>
        </div>
        <span className={cn(
          'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
          isExpired
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary'
        )}>
          {isExpired ? 'Expired' : `${secondsRemaining}s`}
        </span>
      </div>

      {/* Code display */}
      <div className="neu-inset rounded-xl px-5 py-4 flex items-center justify-between gap-3 mb-3">
        <div className="font-mono text-3xl font-black tracking-[0.3em] text-foreground">
          {inviteCode?.code ?? '——————'}
        </div>
        <button
          type="button"
          onClick={copyCode}
          disabled={!inviteCode}
          title="Copy invite code"
          className="h-9 w-9 neu-raised rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      {/* Countdown bar */}
      {!isExpired && inviteCode && (
        <div className="mb-4 h-1.5 neu-inset rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      )}

      {/* Regenerate */}
      {isAdmin && (
        <button
          type="button"
          onClick={regenerate}
          disabled={isRegenerating}
          className="w-full neu-raised rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          <RefreshCw className={cn('h-4 w-4', isRegenerating && 'animate-spin')} />
          Regenerate Code
        </button>
      )}
    </section>
  );
}
