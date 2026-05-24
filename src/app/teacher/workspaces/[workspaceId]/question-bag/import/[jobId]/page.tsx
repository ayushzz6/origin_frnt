export const dynamic = "force-dynamic";

/**
 * Phase 10 — review dashboard for a single import job.
 *
 * Server component that fetches the job + its draft questions and hands
 * everything to the client island. The island handles bulk-accept,
 * accept-partial (with explicit confirmation), and per-question accept/
 * reject actions through the existing /api/teacher/.../import-jobs/[jobId]
 * route.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImportReviewBoard } from "@/components/teacher/import/ImportReviewBoard";
import {
  getJobQuestions,
  getJobWithProgress,
} from "@/server/workspaces/document-import-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string; jobId: string }>;
};

export default async function ImportReviewPage({ params }: Props) {
  const { workspaceId, jobId } = await params;
  await loadWorkspaceForRender(workspaceId);

  const job = await getJobWithProgress(workspaceId, jobId);
  if (!job) notFound();

  const questions = await getJobQuestions(jobId, { limit: 200 });

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Import Review — {job.sourceFileName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-semibold">{job.status}</span> · Stage:{" "}
            <span className="font-mono text-xs">{job.stage}</span> · Target:{" "}
            <span className="uppercase">{job.targetSurface}</span>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/teacher/workspaces/${workspaceId}/question-bag/import`}>
            Back to import list
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Extracted" value={job.totalQuestions ?? 0} />
        <SummaryCard label="Accepted" value={job.acceptedQuestions} />
        <SummaryCard label="Needs review" value={job.reviewRequiredQuestions} />
        <SummaryCard
          label="Pages processed"
          value={`${job.processedPages}/${job.totalPages ?? "?"}`}
        />
      </div>

      {Object.keys(job.classification ?? {}).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Classification</CardTitle>
            <CardDescription>
              How the classifier routed this document.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted/30 p-3 text-xs">
              {JSON.stringify(job.classification, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

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

      <ImportReviewBoard
        workspaceId={workspaceId}
        jobId={jobId}
        initialQuestions={questions}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
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
