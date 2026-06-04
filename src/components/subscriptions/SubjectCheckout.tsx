'use client';

/**
 * Phase 1.5 — one subject's subscribe / manage control.
 *
 * On subscribe it creates the Razorpay subscription server-side, then opens the
 * Razorpay Checkout for the mandate. Entitlement is NOT unlocked optimistically:
 * the webhook is the source of truth, so on success we just refresh the user and
 * let the unlock land when the `subscription.activated` webhook is processed.
 */

import { useCallback, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { Subject } from '@/lib/entitlements';
import { cancelSubscription, createSubscription } from '@/features/subscriptions/client';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

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

export type SubjectCheckoutProps = {
  subject: Subject;
  label: string;
  owned: boolean;
  /** Called after a successful subscribe/cancel so the parent can refreshUser(). */
  onChanged: () => void;
};

export function SubjectCheckout({ subject, label, owned, onChanged }: SubjectCheckoutProps) {
  const [busy, setBusy] = useState(false);

  const handleSubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Could not load the secure checkout. Please try again.');
      }
      const { subscriptionId, razorpayKeyId } = await createSubscription(subject);
      const checkout = new window.Razorpay({
        key: razorpayKeyId,
        subscription_id: subscriptionId,
        name: 'Origin',
        description: `${label} — Premium (₹499/month)`,
        theme: { color: '#4f46e5' },
        handler: () => {
          toast.success('Payment received — unlocking your subject shortly.');
          // Webhook is the source of truth; refresh to pick up entitlement.
          setTimeout(onChanged, 1500);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.open();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start checkout.');
      setBusy(false);
    }
  }, [subject, label, onChanged]);

  const handleCancel = useCallback(async () => {
    setBusy(true);
    try {
      await cancelSubscription(subject);
      toast.success('Subscription will end at the close of the current billing period.');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel the subscription.');
    } finally {
      setBusy(false);
    }
  }, [subject, onChanged]);

  if (owned) {
    return (
      <Button
        variant="outline"
        className="w-full rounded-full py-6"
        onClick={handleCancel}
        disabled={busy}
      >
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Manage / Cancel
      </Button>
    );
  }

  return (
    <Button
      className="w-full rounded-full py-6 bg-primary text-white hover:opacity-90"
      onClick={handleSubscribe}
      disabled={busy}
    >
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
      Subscribe · ₹499/mo
    </Button>
  );
}

/** Small "Active" pill for an owned subject. */
export function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300">
      <Check className="w-3 h-3" /> Active
    </span>
  );
}
