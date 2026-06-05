'use client';

/**
 * Phase 2F.2 — teacher-side "Request collaboration with Origin" card.
 *
 * Rendered on an institute workspace's Settings page (when `teacherConnect` is on
 * and the actor can edit). Shows the current collaboration status and lets an
 * owner/admin request a collaboration. With CONNECT_AUTO_APPROVE=1 the request is
 * approved instantly (status → active); otherwise it waits for admin approval.
 */

import { useState } from 'react';
import { Building2, CheckCircle2, Clock, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import {
  requestMyCollaboration,
  type Collaboration,
  type CollaborationStatus,
} from '@/features/connect/client';

const STATUS_META: Record<CollaborationStatus, { label: string; tone: string; icon: typeof Clock }> = {
  active: { label: 'Active collaborator', tone: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  pending: { label: 'Pending Origin review', tone: 'text-amber-600 dark:text-amber-400', icon: Clock },
  paused: { label: 'Paused', tone: 'text-amber-600 dark:text-amber-400', icon: ShieldAlert },
  terminated: { label: 'Terminated', tone: 'text-rose-600 dark:text-rose-400', icon: ShieldAlert },
  rejected: { label: 'Rejected', tone: 'text-rose-600 dark:text-rose-400', icon: ShieldAlert },
};

export function CollaborationRequestCard({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: Collaboration | null;
}) {
  const [collaboration, setCollaboration] = useState<Collaboration | null>(initial);
  const [submitting, setSubmitting] = useState(false);

  async function handleRequest() {
    setSubmitting(true);
    try {
      const result = await requestMyCollaboration(workspaceId);
      setCollaboration(result);
      toast.success(
        result.status === 'active'
          ? 'Your institute is now an active Origin collaborator.'
          : 'Collaboration requested — awaiting Origin approval.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not request collaboration.');
    } finally {
      setSubmitting(false);
    }
  }

  const status = collaboration?.status;
  const meta = status ? STATUS_META[status] : null;
  const canRequest = !collaboration || status === 'rejected' || status === 'terminated';

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight">Origin Collaboration</h2>
            {meta && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${meta.tone}`}>
                <meta.icon className="w-4 h-4" />
                {meta.label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your institute with Origin so students can enrol via a code or in-app
            checkout, and unlock teacher tests, rooms and cohort analytics for your batches.
          </p>

          {status === 'active' && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-accent text-foreground/80">
                Code enrolment {collaboration?.flow1Enabled ? 'enabled' : 'off'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-accent text-foreground/80">
                In-app checkout {collaboration?.flow2Enabled ? 'enabled' : 'off'}
              </span>
            </div>
          )}

          {canRequest && (
            <button
              onClick={handleRequest}
              disabled={submitting}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
              {collaboration ? 'Request again' : 'Request collaboration'}
            </button>
          )}

          {status === 'pending' && (
            <p className="mt-4 text-xs text-muted-foreground">
              Your request has been submitted. Origin will review it shortly.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
