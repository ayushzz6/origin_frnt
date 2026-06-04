'use client';

/**
 * Phase 14 Flow 2 — in-app enrollment checkout.
 *
 * Lets the student optionally add Origin subject(s) alongside the batch tuition,
 * then opens Razorpay Checkout SEQUENTIALLY for each subscription id (there is no
 * native combined multi-subscription mandate — see plan Risk #1). Entitlement /
 * enrollment is NOT unlocked optimistically: the webhook is the source of truth,
 * so on completion we just refreshUser() and let the grants land.
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { ALL_SUBJECTS, getEntitledSubjects, type Subject } from '@/lib/entitlements';
import { createConnectCheckout } from '@/features/connect/client';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const SUBJECT_LABELS: Record<Subject, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  handler?: (response: unknown) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Open one Razorpay subscription mandate and resolve when it succeeds/dismisses. */
function openMandate(
  key: string,
  subscriptionId: string,
  description: string,
): Promise<'paid' | 'dismissed'> {
  return new Promise((resolve) => {
    if (!window.Razorpay) return resolve('dismissed');
    const checkout = new window.Razorpay({
      key,
      subscription_id: subscriptionId,
      name: 'Origin',
      description,
      theme: { color: '#4f46e5' },
      handler: () => resolve('paid'),
      modal: { ondismiss: () => resolve('dismissed') },
    });
    checkout.open();
  });
}

export type ConnectCheckoutProps = {
  workspaceId: string;
  offeringId: string;
  offeringTitle: string;
  priceLabel: string;
};

export function ConnectCheckout({
  workspaceId,
  offeringId,
  offeringTitle,
  priceLabel,
}: ConnectCheckoutProps) {
  const { user, refreshUser } = useAuth();
  const owned = useMemo(() => new Set(getEntitledSubjects(user)), [user]);
  const [selected, setSelected] = useState<Set<Subject>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = useCallback((subject: Subject) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  }, []);

  const handleEnroll = useCallback(async () => {
    setBusy(true);
    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Could not load the secure checkout. Please try again.');
      }
      const result = await createConnectCheckout({
        workspaceId,
        offeringId,
        addonSubjects: [...selected],
      });
      if (result.status === 'pending') {
        toast.info(result.detail);
        setBusy(false);
        return;
      }

      // Sequential mandates: batch tuition first, then each subject add-on.
      const batch = await openMandate(
        result.razorpayKeyId,
        result.batchSubscription.subscriptionId,
        `${offeringTitle} — batch tuition`,
      );
      if (batch === 'dismissed') {
        toast.message('Checkout cancelled before the batch mandate completed.');
        setBusy(false);
        return;
      }
      for (const addon of result.addonSubscriptions) {
        await openMandate(
          result.razorpayKeyId,
          addon.subscriptionId,
          `${SUBJECT_LABELS[addon.subject]} — Premium (₹499/month)`,
        );
      }

      toast.success('Payment received — your enrollment will unlock shortly.');
      setDone(true);
      setTimeout(() => void refreshUser(), 1500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start checkout.');
    } finally {
      setBusy(false);
    }
  }, [workspaceId, offeringId, offeringTitle, selected, refreshUser]);

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enrollment in progress</CardTitle>
          <CardDescription>
            We&apos;re confirming your payment. Your batch and any added subjects unlock automatically.
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

  const addonChoices = ALL_SUBJECTS.filter((s) => !owned.has(s));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{offeringTitle}</CardTitle>
        <CardDescription>Batch tuition billed {priceLabel}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {addonChoices.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">Add Origin subjects (₹499/mo each, optional)</p>
            <div className="flex flex-wrap gap-2">
              {addonChoices.map((subject) => (
                <Button
                  key={subject}
                  type="button"
                  size="sm"
                  variant={selected.has(subject) ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => toggle(subject)}
                  disabled={busy}
                >
                  {SUBJECT_LABELS[subject]}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            You already own every Origin subject — just the batch tuition applies.
          </p>
        )}
        {owned.size > 0 ? (
          <div className="flex flex-wrap gap-1">
            {[...owned].map((s) => (
              <Badge key={s} variant="secondary" className="capitalize">
                {s} · owned
              </Badge>
            ))}
          </div>
        ) : null}
        <Button onClick={handleEnroll} disabled={busy} className="rounded-full">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enroll & pay
        </Button>
        <p className="text-xs text-muted-foreground">
          You&apos;ll authorize each subscription one at a time. Access unlocks once payment confirms.
        </p>
      </CardContent>
    </Card>
  );
}

export default ConnectCheckout;
