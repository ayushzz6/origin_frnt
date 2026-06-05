export const dynamic = "force-dynamic";

import { WorkspaceSettingsHighFidelity } from "@/components/teacher/WorkspaceSettingsHighFidelity";
import { CollaborationRequestCard } from "@/components/teacher/CollaborationRequestCard";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { listCodesForWorkspace, listMembers } from "@/server/workspaces/store";
import { getCollaboration } from "@/server/connect/collaboration-service";
import { isFeatureEnabled } from "@/lib/feature-flags";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  const { workspace, membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canEdit =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin";

  const codes = canEdit ? await listCodesForWorkspace(workspaceId) : [];
  const members = await listMembers(workspaceId);

  // Phase 2F.2 — institute owners/admins can request an Origin collaboration.
  const showCollaboration =
    isFeatureEnabled("teacherConnect") && workspace.workspaceType === "institute" && canEdit;
  const collaboration = showCollaboration ? await getCollaboration(workspaceId) : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage workspace settings, co-teachers permissions, and OGCode publications.
        </p>
      </div>

      {showCollaboration && (
        <CollaborationRequestCard workspaceId={workspaceId} initial={collaboration} />
      )}

      <WorkspaceSettingsHighFidelity
        workspace={workspace} 
        initialCodes={codes} 
        initialMembers={members} 
        canEdit={canEdit} 
      />
    </div>
  );
}
