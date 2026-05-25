import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loadAccessibleWorkspaces } from "@/server/workspaces/server-loader";
import { TeacherLogoutButton } from "@/components/teacher/TeacherLogoutButton";

export default async function TeacherHomePage() {
  const workspaces = await loadAccessibleWorkspaces();
  if (workspaces.length === 1) {
    redirect(`/teacher/workspaces/${workspaces[0].id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your workspaces</h1>
          <p className="text-muted-foreground mt-2">
            Pick a workspace to continue, or start a new one.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/onboarding">New workspace</Link>
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No workspaces yet</CardTitle>
            <CardDescription>
              Create your first workspace to manage students, batches, tests, and analytics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/teacher/onboarding">Create workspace</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((workspace) => (
            <Link key={workspace.id} href={`/teacher/workspaces/${workspace.id}`} className="block">
              <Card className="transition-all hover:border-primary/40 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {workspace.displayName}
                    <span className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                      {workspace.workspaceType}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Role: {workspace.role} · Status: {workspace.status}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <TeacherLogoutButton />
    </div>
  );
}
