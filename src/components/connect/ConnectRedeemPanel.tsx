'use client';

/**
 * Phase 14 Flow 1 — redeem an institute code, then pick ONE Origin subject.
 *
 * Step 1: the student enters the code their institute issued (fees collected
 * externally). On redeem they are enrolled `unassigned`.
 * Step 2: the student picks exactly one Origin subject; a non-Razorpay,
 * time-bound grant unlocks it. We refreshUser() so the new entitlement lands.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { ALL_SUBJECTS, type Subject } from '@/lib/entitlements';
import {
  grantConnectSubject,
  redeemConnectCode,
  type RedeemCodeResult,
} from '@/features/connect/client';

const SUBJECT_LABELS: Record<Subject, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};

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
        toast.success(`${SUBJECT_LABELS[subject]} unlocked.`);
        await refreshUser();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not unlock that subject.');
      } finally {
        setBusy(false);
      }
    },
    [redeemed, refreshUser],
  );

  if (grantedSubject && redeemed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" /> {SUBJECT_LABELS[grantedSubject]} unlocked
          </CardTitle>
          <CardDescription>
            You&apos;re connected to {redeemed.workspace.displayName} and your subject is active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="rounded-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (redeemed) {
    const eligible = redeemed.eligibleSubjects.length ? redeemed.eligibleSubjects : ALL_SUBJECTS;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pick your subject</CardTitle>
          <CardDescription>
            Connected to {redeemed.workspace.displayName}. Choose the one Origin subject to unlock.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {eligible.map((subject) => (
            <Button
              key={subject}
              variant="outline"
              className="justify-start rounded-xl py-6"
              disabled={busy}
              onClick={() => handlePick(subject)}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {SUBJECT_LABELS[subject]}
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter your institute code</CardTitle>
        <CardDescription>
          Your institute gives you a join code after enrolling. Redeem it here to connect.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleRedeem}>
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="e.g. ORIGIN-AB12CD"
            autoComplete="off"
            className="sm:max-w-xs"
          />
          <Button type="submit" disabled={busy || !code.trim()} className="rounded-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Redeem code
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default ConnectRedeemPanel;
