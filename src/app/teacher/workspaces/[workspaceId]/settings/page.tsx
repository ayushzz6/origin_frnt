import { WorkspaceCodeManager } from "@/components/teacher/WorkspaceCodeManager";
import { WorkspaceSettingsForm } from "@/components/teacher/WorkspaceSettingsForm";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { listCodesForWorkspace } from "@/server/workspaces/store";

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

  return (
    <div className="max-w-2xl space-y-10">
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {canEdit
              ? "Update display info for this workspace."
              : "You do not have permission to edit settings."}
          </p>
        </div>
        <WorkspaceSettingsForm workspace={workspace} canEdit={canEdit} />
      </section>

      {canEdit ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Student join codes</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Share these codes so students can enroll into your workspace. Rotate when a code leaks.
            </p>
          </div>
          <WorkspaceCodeManager workspaceId={workspaceId} initialCodes={codes} />
        </section>
      ) : null}
    </div>
  );
}
