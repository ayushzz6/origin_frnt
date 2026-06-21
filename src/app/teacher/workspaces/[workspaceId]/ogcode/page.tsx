export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { OgcodeBrowse } from "@/components/teacher/OgcodeBrowse";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function TeacherOgcodePage({ params }: Props) {
  if (!isFeatureEnabled("teacherOgcode")) notFound();
  const { workspaceId } = await params;
  // Ensures the caller is a member of this workspace (throws/redirects otherwise).
  await loadWorkspaceForRender(workspaceId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">OG Code</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse the full ORIGIN question bank. Add these questions to a test from the test
          builder (Tests → Create) or inside a room.
        </p>
      </div>
      <OgcodeBrowse workspaceId={workspaceId} />
    </div>
  );
}
