export const dynamic = "force-dynamic";

/**
 * Phase 11 — admin import-job detail.
 *
 * Read-only view of one job's full state, including the JSONB diagnostics
 * and cost payloads written by the FastAPI worker.
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
import { getImportJobAdminService } from "@/server/workspaces/admin-service";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function AdminImportJobDetail({ params }: Props) {
  const { jobId } = await params;
  const job = await getImportJobAdminService(jobId);
  if (!job) notFound();

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {job.sourceFileName}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Badge>{job.status}</Badge> · stage {job.stage} · workspace{" "}
            <Link
              href={`/admin/workspaces/${job.workspaceId}`}
              className="font-mono text-xs hover:underline"
            >
              {job.workspaceId}
            </Link>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/import-jobs">Back to list</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Total questions" value={job.totalQuestions ?? 0} />
        <SummaryCard label="Accepted" value={job.acceptedQuestions} />
        <SummaryCard label="Needs review" value={job.reviewRequiredQuestions} />
        <SummaryCard
          label="Processed pages"
          value={`${job.processedPages}/${job.totalPages ?? "?"}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs">
            {JSON.stringify(job.classification, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs">
            {JSON.stringify(job.diagnostics, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost / latency</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs">
            {JSON.stringify(job.cost, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {job.errorMessage ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Pipeline error</CardTitle>
            <CardDescription>
              {job.errorCode ?? "ERROR"} — {job.errorMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
