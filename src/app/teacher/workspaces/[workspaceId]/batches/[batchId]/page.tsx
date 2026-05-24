export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchRosterManager } from "@/components/teacher/BatchRosterManager";
import { getBatch, listBatchMembers } from "@/server/workspaces/batches";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string; batchId: string }>;
};

export default async function BatchDetailPage({ params }: Props) {
  const { workspaceId, batchId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const batch = await getBatch(workspaceId, batchId);
  if (!batch) notFound();
  const [members, enrollments] = await Promise.all([
    listBatchMembers(workspaceId, batchId),
    listEnrollments(workspaceId, { status: "all" }),
  ]);
  const canManage =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  const memberIds = new Set(members.map((m) => m.studentId));
  const candidates = enrollments.filter(
    (e) =>
      (e.status === "unassigned" || e.status === "active") &&
      !memberIds.has(e.studentId),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{batch.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {[batch.course, batch.subject, batch.classLevel].filter(Boolean).join(" · ") || "—"} ·{" "}
          {batch.status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster ({members.length})</CardTitle>
          <CardDescription>
            {canManage ? "Add or remove students from this batch." : "Read-only view."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchRosterManager
            workspaceId={workspaceId}
            batchId={batchId}
            members={members}
            candidates={candidates}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
