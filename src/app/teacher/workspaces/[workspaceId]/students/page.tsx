export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentsManager } from "@/components/teacher/StudentsManager";
import { listBatches } from "@/server/workspaces/batches";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceStudentsPage({ params }: Props) {
  const { workspaceId } = await params;
  await loadWorkspaceForRender(workspaceId);
  const [enrollments, batches] = await Promise.all([
    listEnrollments(workspaceId, { status: "all" }),
    listBatches(workspaceId, { status: "active" }),
  ]);
  const unassigned = enrollments.filter((e) => e.status === "unassigned");
  const active = enrollments.filter((e) => e.status === "active");
  const suspended = enrollments.filter(
    (e) => e.status === "suspended" || e.status === "left",
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {enrollments.length} enrolled · {unassigned.length} awaiting assignment
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unassigned</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentsManager
            workspaceId={workspaceId}
            students={unassigned}
            batches={batches}
            emptyLabel="No unassigned students yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentsManager
            workspaceId={workspaceId}
            students={active}
            batches={batches}
            emptyLabel="No active students yet."
          />
        </CardContent>
      </Card>

      {suspended.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Suspended / left</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentsManager
              workspaceId={workspaceId}
              students={suspended}
              batches={batches}
              emptyLabel=""
              readOnly
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
