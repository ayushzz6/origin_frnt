'use client';

/**
 * Phase 2F.3 — platform-admin collaborations panel.
 *
 * Lists every institute collaboration and lets an admin transition its lifecycle
 * (approve → active, pause, terminate, reject). Approving lights up both enrolment
 * flows. With CONNECT_AUTO_APPROVE=1 most rows arrive already `active`, so this is
 * primarily an oversight surface (pause/terminate a bad actor).
 */

import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  listAdminCollaborations,
  setAdminCollaborationStatus,
  type AdminCollaboration,
  type CollaborationStatus,
} from '@/features/connect/client';

const STATUS_TONE: Record<CollaborationStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  terminated: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const ACTIONS: { label: string; status: CollaborationStatus; tone: string }[] = [
  { label: 'Approve', status: 'active', tone: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  { label: 'Pause', status: 'paused', tone: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { label: 'Terminate', status: 'terminated', tone: 'bg-rose-500 hover:bg-rose-600 text-white' },
  { label: 'Reject', status: 'rejected', tone: 'bg-muted hover:bg-accent text-foreground' },
];

export function AdminCollaborationsPanel({ initial }: { initial: AdminCollaboration[] }) {
  const [rows, setRows] = useState<AdminCollaboration[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      setRows(await listAdminCollaborations('all'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh.');
    }
  }

  async function act(workspaceId: string, status: CollaborationStatus) {
    setBusy(`${workspaceId}:${status}`);
    try {
      const updated = await setAdminCollaborationStatus({ workspaceId, status });
      setRows((prev) => prev.map((r) => (r.workspaceId === workspaceId ? { ...r, ...updated } : r)));
      toast.success(`Collaboration ${status}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-500" /> Collaborations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Institute partners on Origin. Approve to light up code &amp; in-app enrolment.
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 rounded-xl border border-border text-sm font-bold hover:bg-accent transition-colors"
        >
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No collaboration requests yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/50 text-muted-foreground">
              <tr>
                <th className="text-left font-bold px-4 py-3">Institute</th>
                <th className="text-left font-bold px-4 py-3">Status</th>
                <th className="text-left font-bold px-4 py-3">Requested</th>
                <th className="text-right font-bold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground">{row.workspaceDisplayName || row.workspaceId}</div>
                    <div className="text-xs text-muted-foreground">{row.workspaceType}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_TONE[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {ACTIONS.filter((a) => a.status !== row.status).map((a) => (
                        <button
                          key={a.status}
                          onClick={() => act(row.workspaceId, a.status)}
                          disabled={busy !== null}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${a.tone}`}
                        >
                          {busy === `${row.workspaceId}:${a.status}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            a.label
                          )}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
