import { notFound } from "next/navigation";
import { AnalyticsCenterHighFidelity } from "@/components/teacher/AnalyticsCenterHighFidelity";
import { listBatches } from "@/server/workspaces/batches";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceAnalyticsPage({ params }: Props) {
  const { workspaceId } = await params;
  await loadWorkspaceForRender(workspaceId);

  // Fetch batches to pass a default target batch ID to analytics
  const batches = await listBatches(workspaceId, { status: "active" });
  if (batches.length === 0) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-8 border border-dashed rounded-2xl text-center text-muted-foreground">
        <h2 className="text-lg font-bold text-foreground mb-1">No Active Batches</h2>
        <p className="text-xs">Create a batch and assign students to begin viewing subject analytics.</p>
      </div>
    );
  }

  const defaultBatchId = batches[0].id;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor subject mastery levels, identify chapter weakness clusters, and issue remedial worksheets.
        </p>
      </div>

      <AnalyticsCenterHighFidelity
        workspaceId={workspaceId}
        batchId={defaultBatchId}
      />
    </div>
  );
}
