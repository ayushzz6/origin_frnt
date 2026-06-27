'use client';

/**
 * Phase 14 Flow 1 — redeem an institute code, then pick ONE Origin subject.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Check, FlaskConical, Loader2, BookOpen, Atom, Calculator, Leaf } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

import { useAuth } from '@/context/AuthContext';
import { ALL_SUBJECTS, type Subject } from '@/lib/entitlements';
import {
  grantConnectSubject,
  redeemConnectCode,
  type RedeemCodeResult,
} from '@/features/connect/client';
import { cn } from '@/lib/utils';

const SUBJECT_META: Record<Subject, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  physics:     { label: 'Physics',     Icon: Atom,       color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-400/30'   },
  chemistry:   { label: 'Chemistry',   Icon: FlaskConical, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-400/30' },
  mathematics: { label: 'Mathematics', Icon: Calculator,  color: 'text-emerald-600',bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400/30' },
  biology:     { label: 'Biology',     Icon: Leaf,        color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20 border-green-400/30'   },
};

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay: 0.07 * i },
});

export function ConnectRedeemPanel() {
  const { refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [redeemed, setRedeemed] = useState<RedeemCodeResult | null>(null);
  const [grantedSubject, setGrantedSubject] = useState<Subject | null>(null);

  const handleRedeem = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!code.trim()) return;
      setBusy(true);
      try {
        const result = await redeemConnectCode(code.trim());
        setRedeemed(result);
        toast.success(`Connected to ${result.workspace.displayName}. Now pick your subject.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not redeem that code.');
      } finally {
        setBusy(false);
      }
    },
    [code],
  );

  const handlePick = useCallback(
    async (subject: Subject) => {
      if (!redeemed) return;
      setBusy(true);
      try {
        await grantConnectSubject(redeemed.workspace.id, subject);
        setGrantedSubject(subject);
        toast.success(`${SUBJECT_META[subject].label} unlocked.`);
        await refreshUser();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not unlock that subject.');
      } finally {
        setBusy(false);
      }
    },
    [redeemed, refreshUser],
  );

  /* ── Step 3: done ─────────────────────────────────────────── */
  if (grantedSubject && redeemed) {
    const meta = SUBJECT_META[grantedSubject];
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="neu-raised p-8 flex flex-col items-center gap-4 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Check className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <p className="font-black text-lg text-foreground">{meta.label} unlocked</p>
          <p className="text-xs text-muted-foreground mt-1">
            You&apos;re connected to <span className="font-bold text-foreground">{redeemed.workspace.displayName}</span> and your subject is active.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="neu-btn w-full text-center py-2.5 text-[11px] font-black uppercase tracking-wider text-primary rounded-xl"
        >
          Go to dashboard →
        </Link>
      </motion.div>
    );
  }

  /* ── Step 2: pick subject ─────────────────────────────────── */
  if (redeemed) {
    const eligible = redeemed.eligibleSubjects.length ? redeemed.eligibleSubjects : ALL_SUBJECTS;
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <div className="neu-raised p-5 text-center space-y-1">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Connected to</p>
          <p className="font-black text-lg text-foreground">{redeemed.workspace.displayName}</p>
          <p className="text-xs text-muted-foreground">Choose the one Origin subject to unlock.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {eligible.map((subject, i) => {
            const meta = SUBJECT_META[subject];
            return (
              <motion.button
                key={subject}
                {...stagger(i)}
                disabled={busy}
                onClick={() => handlePick(subject)}
                className={cn(
                  'neu-raised neu-pressable p-5 flex items-center gap-4 text-left rounded-2xl border transition-all disabled:opacity-50',
                  meta.bg,
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', meta.bg)}>
                  <meta.Icon className={cn('w-5 h-5', meta.color)} />
                </div>
                <div>
                  <p className={cn('font-black text-sm', meta.color)}>{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">Tap to unlock</p>
                </div>
                {busy && <Loader2 className="w-4 h-4 animate-spin ml-auto text-muted-foreground" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Step 1: enter code ───────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto">
      <div className="neu-raised p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-black text-foreground">Enter your institute code</p>
              <p className="text-xs text-muted-foreground">
                Your institute gives you a join code after enrolling.
              </p>
            </div>
          </div>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleRedeem}>
          <div className="relative flex-1">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ORIGIN-AB12CD"
              autoComplete="off"
              className="w-full h-11 px-4 rounded-xl neu-inset text-sm font-bold text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className={cn(
              'h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200',
              busy || !code.trim()
                ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-lg shadow-primary/20'
            )}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Redeem'}
          </button>
        </form>

        <p className="text-[10px] text-muted-foreground text-center">
          Don&apos;t have a code? Ask your coaching institute to share one.
        </p>
      </div>
    </div>
  );
}

export default ConnectRedeemPanel;
