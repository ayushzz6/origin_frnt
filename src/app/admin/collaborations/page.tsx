export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import AdminLayout from "@/components/layout/AdminLayout";
import { AdminCollaborationsPanel } from "@/components/admin/AdminCollaborationsPanel";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { listCollaborationsService } from "@/server/connect/collaboration-service";

/**
 * Phase 2F.3 — platform-admin collaborations approval surface. Dark behind
 * `teacherConnect` (404 when off); admin-only (mirrors the other /admin pages).
 */
export default async function AdminCollaborationsPage() {
  if (!isFeatureEnabled("teacherConnect")) notFound();
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/admin/collaborations");
  if (user.role !== "admin") redirect("/dashboard");

  const collaborations = await listCollaborationsService({ status: "all" });

  return (
    <AdminLayout>
      <AdminCollaborationsPanel initial={collaborations} />
    </AdminLayout>
  );
}
