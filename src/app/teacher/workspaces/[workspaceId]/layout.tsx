export const dynamic = "force-dynamic";

import { TeacherHeader } from "@/components/teacher/TeacherHeader";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  loadWorkspaceLayoutData,
} from "@/server/workspaces/server-loader";

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

type NavItem = { href: string; label: string; flag?: "paidEnrollment" };

const NAV_ITEMS: NavItem[] = [
  { href: "", label: "Overview" },
  { href: "/students", label: "Students" },
  { href: "/batches", label: "Batches" },
  { href: "/question-bag", label: "Question Bag" },
  { href: "/tests", label: "Tests" },
  { href: "/rooms", label: "Rooms" },
  // Audit fix R-3 (A-11): Marketplace was reachable only by URL.
  // The /offerings page exists and is functional; expose it.
  { href: "/offerings", label: "Marketplace", flag: "paidEnrollment" },
  { href: "/settings", label: "Settings" },
];

export default async function WorkspaceLayout({ children, params }: Props) {
  const { workspaceId } = await params;
  const { context, accessible } = await loadWorkspaceLayoutData(workspaceId);
  const current = accessible.find((w) => w.id === workspaceId) ?? {
    ...context.workspace,
    role: "owner" as const,
    memberStatus: "active" as const,
  };

  const marketplaceEnabled = isFeatureEnabled("paidEnrollment");
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.flag || isFeatureEnabled(item.flag),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TeacherHeader
        workspaceId={workspaceId}
        current={current}
        workspaces={accessible}
        visibleNavItems={visibleNavItems}
        isPlatformAdmin={context.isPlatformAdmin}
        membership={context.membership}
        marketplaceEnabled={marketplaceEnabled}
      />
      <main className="flex-1 px-4 pt-6 pb-20 md:px-6 md:pt-8 md:pb-24 lg:pb-8">{children}</main>
    </div>
  );
}
