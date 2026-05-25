export const dynamic = "force-dynamic";

import { WorkspaceSettingsHighFidelity } from "@/components/teacher/WorkspaceSettingsHighFidelity";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { listCodesForWorkspace, listMembers } from "@/server/workspaces/store";

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage workspace settings, co-teachers permissions, and OGCode publications.
        </p>
      </div>
      
      <WorkspaceSettingsHighFidelity 
        workspace={workspace} 
        initialCodes={codes} 
        initialMembers={members} 
        canEdit={canEdit} 
      />
    </div>
  );
}
