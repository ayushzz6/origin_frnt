export const dynamic = "force-dynamic";

import { StudentsManagerHighFidelity } from "@/components/teacher/StudentsManagerHighFidelity";
import { listBatches } from "@/server/workspaces/batches";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceStudentsPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  
  // Parallel fetch enrollments and batches
  const [enrollments, batches] = await Promise.all([
    listEnrollments(workspaceId, { status: "all" }),
    listBatches(workspaceId, { status: "active" }),
  ]);

  const canManage =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students Directory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Approve onboarding queue memberships, filter by batch rosters, and manage student statuses.
        </p>
      </div>

      <StudentsManagerHighFidelity
        workspaceId={workspaceId}
        students={enrollments}
        batches={batches}
        canManage={canManage}
      />
    </div>
  );
}
