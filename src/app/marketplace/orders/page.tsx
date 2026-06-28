export const dynamic = "force-dynamic";

/**
 * Phase 12 — student's own enrollment orders.
 */

import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-server";
import { listStudentOrdersService } from "@/server/workspaces/marketplace-service";
import type { EnrollmentOrderStatus } from "@/server/workspaces/types";

const STATUS_CONFIG: Record<EnrollmentOrderStatus, { label: string; cls: string }> = {
  created:         { label: "Created",         cls: "bg-muted text-muted-foreground" },
  payment_pending: { label: "Pending",         cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  paid:            { label: "Paid",            cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  failed:          { label: "Failed",          cls: "bg-destructive/10 text-destructive" },
  refunded:        { label: "Refunded",        cls: "bg-muted text-muted-foreground" },
  cancelled:       { label: "Cancelled",       cls: "bg-muted text-muted-foreground" },
};

export default async function StudentOrdersPage() {
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/marketplace/orders");
  const orders = await listStudentOrdersService(user.id);

  return (
    <div className="min-h-screen neu-surface text-foreground">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-primary mb-1">Account</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Your Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every marketplace purchase you&apos;ve made on ORIGIN.
          </p>
        </div>

        <div className="neu-raised rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground">Paid orders auto-enroll you into the batch.</p>
          </div>

          {orders.length === 0 ? (
            <div className="neu-inset rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">You haven&apos;t purchased anything yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 pb-1">
                {["Order", "Workspace", "Amount", "Status", "Date"].map((h) => (
                  <span key={h} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</span>
                ))}
              </div>
              {orders.map((o) => {
                const cfg = STATUS_CONFIG[o.status];
                return (
                  <div
                    key={o.id}
                    className="neu-inset rounded-xl grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center px-4 py-3"
                  >
                    <span className="font-mono text-xs text-foreground truncate">{o.id}</span>
                    <span className="font-mono text-xs text-muted-foreground truncate">{o.workspaceId}</span>
                    <span className="text-sm font-bold text-foreground whitespace-nowrap">
                      {o.currency} {(o.amountMinor / 100).toFixed(2)}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
