export const dynamic = "force-dynamic";

/**
 * Phase 12 — student's own enrollment orders.
 */

import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getServerUser } from "@/lib/auth-server";
import { listStudentOrdersService } from "@/server/workspaces/marketplace-service";
import type { EnrollmentOrderStatus } from "@/server/workspaces/types";

const STATUS_VARIANT: Record<
  EnrollmentOrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  created: "outline",
  payment_pending: "secondary",
  paid: "default",
  failed: "destructive",
  refunded: "outline",
  cancelled: "outline",
};

export default async function StudentOrdersPage() {
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/marketplace/orders");
  const orders = await listStudentOrdersService(user.id);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your orders</h1>
        <p className="text-sm text-muted-foreground">
          Every marketplace purchase you&apos;ve made on ORIGIN.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>
            Paid orders auto-enroll you into the offering&apos;s batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t purchased anything yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {o.workspaceId}
                    </TableCell>
                    <TableCell>
                      {o.currency} {(o.amountMinor / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status]}>{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
