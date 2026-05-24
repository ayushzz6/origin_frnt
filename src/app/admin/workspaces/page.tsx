// Reads workspace state from Postgres on every request; never prerender.
export const dynamic = "force-dynamic";

/**
 * Phase 11 — admin workspaces list.
 *
 * Server-rendered table backed by admin-service.searchWorkspaces. Search,
 * filter by type/status, then drill into a single workspace to suspend,
 * unsuspend, edit profile, or revoke a code.
 */

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { searchWorkspacesService } from "@/server/workspaces/admin-service";

type Props = {
  searchParams: Promise<{
    query?: string;
    workspaceType?: "personal" | "institute";
    status?: "active" | "suspended" | "all";
  }>;
};

export default async function AdminWorkspacesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const workspaces = await searchWorkspacesService(
    sp.query ?? "",
    {
      workspaceType: sp.workspaceType,
      status: sp.status,
    },
    100,
  );

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Platform-admin view of all teacher / institute workspaces.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>
            Use query string params: <code>?query=&workspaceType=&status=</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" method="get">
            <input
              type="text"
              name="query"
              placeholder="Search by name or slug"
              defaultValue={sp.query ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <select
              name="workspaceType"
              defaultValue={sp.workspaceType ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="personal">Personal</option>
              <option value="institute">Institute</option>
            </select>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{workspaces.length} result{workspaces.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((ws) => (
                  <TableRow key={ws.id}>
                    <TableCell className="font-medium">{ws.displayName}</TableCell>
                    <TableCell className="text-xs uppercase">{ws.workspaceType}</TableCell>
                    <TableCell className="text-xs">
                      {ws.ownerName ?? "—"}
                      <br />
                      <span className="text-muted-foreground">{ws.ownerEmail ?? ""}</span>
                    </TableCell>
                    <TableCell className="text-right">{ws.studentCount}</TableCell>
                    <TableCell className="text-right">{ws.batchCount}</TableCell>
                    <TableCell>
                      <Badge variant={ws.status === "suspended" ? "destructive" : "default"}>
                        {ws.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ws.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/workspaces/${ws.id}`}>Open</Link>
                      </Button>
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
