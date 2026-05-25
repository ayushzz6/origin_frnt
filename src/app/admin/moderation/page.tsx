import { redirect } from "next/navigation";
import { AdminModerationDashboard } from "@/components/admin/AdminModerationDashboard";
import { getServerUser } from "@/lib/auth-server";
import { searchWorkspacesService } from "@/server/workspaces/admin-service";
import { getModerationQueue } from "@/server/workspaces/ogcode-publishing-service";

export default async function AdminModerationPage() {
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/admin/moderation");
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  // Load platform workspace list and pending moderation items
  const [workspaces, pendingPublications] = await Promise.all([
    searchWorkspacesService("", { status: "all" }),
    getModerationQueue()
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Administration Cockpit</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review workspace organizations, moderate community OGCode questions, and deploy rate limits or kill-switches.
        </p>
      </div>

      <AdminModerationDashboard
        initialWorkspaces={workspaces}
        pendingPublications={pendingPublications}
      />
    </div>
  );
}
