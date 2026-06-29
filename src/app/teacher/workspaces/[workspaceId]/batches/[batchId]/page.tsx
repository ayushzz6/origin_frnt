export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchDeleteButton } from "@/components/teacher/BatchDeleteButton";
import { BatchRosterManager } from "@/components/teacher/BatchRosterManager";
import { BatchPlannerHighFidelity } from "@/components/teacher/BatchPlannerHighFidelity";
import { getBatch, listBatchMembers } from "@/server/workspaces/batches";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { getMaterialsVisibleToBatch } from "@/server/workspaces/study-materials-service";
import { getSyllabusTree } from "@/server/workspaces/syllabus-store";
import { listTeacherTests } from "@/server/workspaces/tests-service";
import { Calendar, Users, Target } from "lucide-react";

type Props = {
  params: Promise<{ workspaceId: string; batchId: string }>;
};

export default async function BatchDetailPage({ params }: Props) {
  const { workspaceId, batchId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  
  const batch = await getBatch(workspaceId, batchId);
  if (!batch) notFound();

  // Parallel fetch: members, candidates, materials, tests
  const [
    members,
    enrollments,
    materials,
    tests,
    syllabus
  ] = await Promise.all([
    listBatchMembers(workspaceId, batchId),
    listEnrollments(workspaceId, { status: "all" }),
    getMaterialsVisibleToBatch(workspaceId, batchId),
    listTeacherTests(workspaceId, { status: "all" }),
    getSyllabusTree(workspaceId, batchId, batch.subject).catch(() => null)
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
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      
      {/* Title & Metadata Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{batch.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {[batch.course, batch.subject, batch.classLevel].filter(Boolean).join(" · ") || "General Batch"}
            {" · "}
            Status: <span className="font-semibold text-foreground uppercase text-xs">{batch.status}</span>
          </p>
        </div>
        {canManage ? (
          <BatchDeleteButton
            workspaceId={workspaceId}
            batchId={batchId}
            batchName={batch.name}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Summary & Roster */}
        <div className="space-y-6 lg:col-span-1">
          {/* BatchSummaryCard */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Batch Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Level:</span>
                <span className="font-semibold">{batch.classLevel || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Course focus:</span>
                <span className="font-semibold">{batch.course || "General"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Enrollment:</span>
                <span className="font-semibold text-primary">{members.length} Active Students</span>
              </div>
              {batch.scheduleText && (
                <div className="pt-2 border-t flex items-start gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground block">Weekly Schedule:</span>
                    {batch.scheduleText}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Roster Card */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Roster ({members.length})
              </CardTitle>
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

        {/* Right Side: Chapter Progress & Syllabus Planner */}
        <div className="lg:col-span-2">
          <BatchPlannerHighFidelity
            workspaceId={workspaceId}
            batch={batch}
            materials={materials}
            tests={tests}
            syllabus={syllabus}
            canManage={canManage}
          />
        </div>

      </div>

    </div>
  );
}
