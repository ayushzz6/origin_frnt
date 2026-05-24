export const dynamic = "force-dynamic";

/**
 * Phase 11 — admin audit-event viewer.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditEventsService } from "@/server/workspaces/admin-service";

type Props = {
  searchParams: Promise<{
    workspaceId?: string;
    actorUserId?: string;
    entityType?: string;
    action?: string;
  }>;
};

export default async function AdminAuditEventsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const events = await listAuditEventsService({
    workspaceId: sp.workspaceId,
    actorUserId: sp.actorUserId,
    entityType: sp.entityType,
    action: sp.action,
    limit: 200,
  });

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Events</h1>
        <p className="text-sm text-muted-foreground">
          Every workspace-, code-, import-, OGCode-, and order-mutation
          writes here. Read-only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Pass any combination of workspaceId, actorUserId, entityType,
            action as query parameters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" method="get">
            <input
              name="workspaceId"
              placeholder="workspaceId"
              defaultValue={sp.workspaceId ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="actorUserId"
              placeholder="actorUserId"
              defaultValue={sp.actorUserId ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="entityType"
              placeholder="entityType"
              defaultValue={sp.entityType ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="action"
              placeholder="action"
              defaultValue={sp.action ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{events.length} event{events.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching events.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ev.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.actorName ?? ev.actorUserId ?? "system"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.workspaceName ?? ev.workspaceId ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.entityType} / {ev.entityId}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{ev.action}</TableCell>
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
