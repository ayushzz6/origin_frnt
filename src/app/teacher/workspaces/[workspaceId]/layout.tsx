export const dynamic = "force-dynamic";

import Link from "next/link";

import { TeacherTopbar } from "@/components/teacher/TeacherTopbar";
import { WorkspaceSwitcher } from "@/components/teacher/WorkspaceSwitcher";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  loadAccessibleWorkspaces,
  loadWorkspaceForRender,
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
  const context = await loadWorkspaceForRender(workspaceId);
  const accessible = await loadAccessibleWorkspaces();
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-6 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <WorkspaceSwitcher current={current} workspaces={accessible} />
        <nav className="flex flex-1 items-center gap-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.label}
              href={`/teacher/workspaces/${workspaceId}${item.href}`}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {context.isPlatformAdmin && !context.membership ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
            Platform admin override
          </span>
        ) : null}
        {/* Audit fix R-3 (A-10): expose logout/profile from the teacher chrome. */}
        <TeacherTopbar
          workspaceId={workspaceId}
          marketplaceEnabled={marketplaceEnabled}
        />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
