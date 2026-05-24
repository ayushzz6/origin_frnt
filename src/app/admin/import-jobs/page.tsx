export const dynamic = "force-dynamic";

/**
 * Phase 11 — cross-workspace admin view of document-import jobs.
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
import { listAllImportJobsAdminService } from "@/server/workspaces/admin-service";
import type { ImportJobStatus } from "@/server/workspaces/types";

type Props = {
  searchParams: Promise<{
    status?: ImportJobStatus;
    workspaceId?: string;
  }>;
};

export default async function AdminImportJobsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const jobs = await listAllImportJobsAdminService({
    status: sp.status,
    workspaceId: sp.workspaceId,
    limit: 100,
  });

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Cross-workspace monitoring of document-import-service runs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Status or workspace ID. Pass as query params.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" method="get">
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {(["queued", "processing", "needs_review", "succeeded", "failed", "cancelled"] as const).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
            <input
              type="text"
              name="workspaceId"
              placeholder="workspace id (optional)"
              defaultValue={sp.workspaceId ?? ""}
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
          <CardTitle>{jobs.length} job{jobs.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs match.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.sourceFileName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/admin/workspaces/${job.workspaceId}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {job.workspaceId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs uppercase">{job.targetSurface}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          job.status === "failed"
                            ? "destructive"
                            : job.status === "succeeded"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{job.stage}</TableCell>
                    <TableCell className="text-right">
                      {job.acceptedQuestions}/{job.totalQuestions ?? "?"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/import-jobs/${job.id}`}>Open</Link>
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
