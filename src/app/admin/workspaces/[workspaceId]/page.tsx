export const dynamic = "force-dynamic";

/**
 * Phase 11 — admin workspace detail.
 *
 * Shows the workspace, its codes, recent jobs, and provides the
 * suspend/unsuspend/close + per-code revocation actions through a
 * small client island. All actions hit the /api/admin/workspaces
 * routes added in fix/phase-10-12-review-gaps.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

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
import { AdminWorkspaceActions } from "@/components/admin/AdminWorkspaceActions";
import { listAllImportJobsAdminService } from "@/server/workspaces/admin-service";
import { getWorkspaceById, listCodesForWorkspace } from "@/server/workspaces/store";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function AdminWorkspaceDetailPage({ params }: Props) {
  const { workspaceId } = await params;
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) notFound();

  const [codes, importJobs] = await Promise.all([
    listCodesForWorkspace(workspaceId),
    listAllImportJobsAdminService({ workspaceId, limit: 20 }),
  ]);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {workspace.displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Badge variant={workspace.status === "suspended" ? "destructive" : "default"}>
              {workspace.status}
            </Badge>{" "}
            · {workspace.workspaceType} · created{" "}
            {new Date(workspace.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/workspaces">Back to list</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin actions</CardTitle>
          <CardDescription>
            Every action writes an entry in <code>app.audit_events</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminWorkspaceActions
            workspaceId={workspaceId}
            currentStatus={workspace.status}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace codes</CardTitle>
          <CardDescription>
            Active and revoked join / staff invite / batch codes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No codes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono text-xs">
                      {code.displayCode}
                    </TableCell>
                    <TableCell className="text-xs uppercase">{code.codeType}</TableCell>
                    <TableCell>
                      <Badge variant={code.status === "active" ? "default" : "outline"}>
                        {code.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(code.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {code.status === "active" || code.status === "reserved" ? (
                        <AdminWorkspaceActions
                          workspaceId={workspaceId}
                          currentStatus={workspace.status}
                          mode="revoke-code"
                          codeId={code.id}
                          codeLabel={code.displayCode}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent import jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {importJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No import jobs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      {job.sourceFileName}
                    </TableCell>
                    <TableCell>
                      <Badge>{job.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {job.stage}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString()}
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
