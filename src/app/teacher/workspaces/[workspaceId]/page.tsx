import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspaceId } = await params;
  const { workspace, membership } = await loadWorkspaceForRender(workspaceId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{workspace.displayName}</h1>
        <p className="mt-2 text-muted-foreground">
          {workspace.workspaceType === "institute"
            ? "Institute workspace"
            : "Personal teacher workspace"}
          {" · "}
          {workspace.city ?? workspace.country}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>{workspace.status}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Verification: {workspace.verificationStatus}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your role</CardTitle>
            <CardDescription>{membership?.role ?? "platform admin"}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Member since{" "}
              {membership?.joinedAt
                ? new Date(membership.joinedAt).toLocaleDateString()
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subjects</CardTitle>
            <CardDescription>
              {workspace.subjects.length} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {workspace.subjects.join(", ") || "Not set"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
