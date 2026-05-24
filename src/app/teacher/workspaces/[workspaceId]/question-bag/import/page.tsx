export const dynamic = "force-dynamic";

/**
 * Phase 10 — import upload + job list.
 *
 * Server component: loads the job list from the document-import store
 * and hands it to a small client island that runs the upload form.
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
import { ImportUploadForm } from "@/components/teacher/import/ImportUploadForm";
import { listWorkspaceImportJobs } from "@/server/workspaces/document-import-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import type { ImportJobStatus } from "@/server/workspaces/types";

const STATUS_LABEL: Record<ImportJobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  needs_review: "Needs review",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<
  ImportJobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "outline",
  processing: "secondary",
  needs_review: "default",
  succeeded: "default",
  failed: "destructive",
  cancelled: "outline",
};

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function ImportLandingPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canImport =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher" ||
    membership?.role === "content_manager";

  const jobs = await listWorkspaceImportJobs(workspaceId, { limit: 25 });

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document Import</h1>
          <p className="text-sm text-muted-foreground">
            Upload a question paper (PDF, DOCX or image). The pipeline
            classifies, extracts, verifies, and saves the questions as
            review-required drafts for you to accept.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/teacher/workspaces/${workspaceId}/question-bag`}>
            Back to Question Bag
          </Link>
        </Button>
      </div>

      {canImport ? (
        <Card>
          <CardHeader>
            <CardTitle>Start a new import</CardTitle>
            <CardDescription>
              Files are stored in R2 and processed asynchronously. You can
              continue working — the job appears below and updates as it
              progresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportUploadForm workspaceId={workspaceId} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Import is read-only for your role</CardTitle>
            <CardDescription>
              Ask a workspace owner, admin, teacher, or content manager to
              start an import.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
          <CardDescription>
            Most recent {jobs.length} job{jobs.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No import jobs yet. Upload a file above to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Q&apos;s</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      {job.sourceFileName}
                    </TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">
                      {job.targetSurface}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[job.status]}>
                        {STATUS_LABEL[job.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {job.stage}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.acceptedQuestions + job.reviewRequiredQuestions}/
                      {job.totalQuestions ?? "?"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/teacher/workspaces/${workspaceId}/question-bag/import/${job.id}`}
                        >
                          Review
                        </Link>
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
