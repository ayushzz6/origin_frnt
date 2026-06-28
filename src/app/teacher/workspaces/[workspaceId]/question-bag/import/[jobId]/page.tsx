export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ImportJobsManager } from "@/components/teacher/ImportJobsManager";
import {
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <ImportJobsManager
        workspaceId={workspaceId}
        initialJobs={[job]}
        defaultJobId={jobId}
      />
    </div>
  );
}
