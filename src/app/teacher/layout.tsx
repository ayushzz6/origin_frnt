import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-server";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function TeacherShellLayout({ children }: { children: React.ReactNode }) {
  if (!isFeatureEnabled("workspaces")) {
    redirect("/dashboard");
  }
  const user = await getServerUser();
  if (!user) {
    redirect("/auth?next=/teacher");
  }
  if (user.role !== "teacher" && user.role !== "admin") {
    redirect("/dashboard");
  }
  return <div className="min-h-dvh bg-background">{children}</div>;
}
