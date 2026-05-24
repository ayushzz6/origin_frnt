export const dynamic = "force-dynamic";

import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchCreateButton } from "@/components/teacher/BatchCreateButton";
import { listBatches } from "@/server/workspaces/batches";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceBatchesPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canCreate =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  const batches = await listBatches(workspaceId, { status: "all" });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {batches.length} total · group students for tests, rooms, and analytics.
          </p>
        </div>
        {canCreate ? <BatchCreateButton workspaceId={workspaceId} /> : null}
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No batches yet</CardTitle>
            <CardDescription>
              Create a batch to organize students by course, subject, or class level.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/teacher/workspaces/${workspaceId}/batches/${batch.id}`}
              className="block"
            >
              <Card className="transition-all hover:border-primary/40 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {batch.name}
                    <span className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                      {batch.status}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {[batch.course, batch.subject, batch.classLevel].filter(Boolean).join(" · ") || "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{batch.studentCount} students</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
