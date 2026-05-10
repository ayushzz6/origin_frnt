'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  return (
    <section className="rounded-lg border border-primary/20 bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Invite Code</h2>
        </div>
        <Badge variant={secondsRemaining > 0 ? 'secondary' : 'destructive'} className="rounded-md">
          {secondsRemaining > 0 ? `${secondsRemaining}s` : 'Expired'}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-4 dark:bg-slate-900">
        <div className="font-mono text-3xl font-black tracking-[0.32em] text-slate-950 dark:text-white">
          {inviteCode?.code ?? '------'}
        </div>
        <Button size="icon" variant="ghost" onClick={copyCode} disabled={!inviteCode} title="Copy invite code">
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {isAdmin && (
        <Button
          variant="outline"
          className={cn('mt-4 w-full', isRegenerating && 'opacity-80')}
          onClick={regenerate}
          disabled={isRegenerating}
        >
          <RefreshCw className={cn('h-4 w-4', isRegenerating && 'animate-spin')} />
          Regenerate Code
        </Button>
      )}
    </section>
  );
}
