export const dynamic = "force-dynamic";

import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";

import OriLoadingScreen from "@/components/ui/OriLoadingScreen";
import { getImportJob } from "@/server/workspaces/document-import-store";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

const ImportJobsManager = nextDynamic(
  () =>
    import("@/components/teacher/ImportJobsManager").then((m) => ({
      default: m.ImportJobsManager,
    })),
  { loading: () => <OriLoadingScreen /> },
);

type Props = {
  params: Promise<{ workspaceId: string; jobId: string }>;
};

export default async function ImportReviewPage({ params }: Props) {
  const { workspaceId, jobId } = await params;
  await loadWorkspaceForRender(workspaceId);

  const job = await getImportJob(workspaceId, jobId);
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
