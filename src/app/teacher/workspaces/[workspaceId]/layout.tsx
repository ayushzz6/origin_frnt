import Link from "next/link";

import { WorkspaceSwitcher } from "@/components/teacher/WorkspaceSwitcher";
import {
  loadAccessibleWorkspaces,
  loadWorkspaceForRender,
} from "@/server/workspaces/server-loader";

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

const NAV_ITEMS = [
  { href: "", label: "Overview" },
  { href: "/students", label: "Students" },
  { href: "/batches", label: "Batches" },
  { href: "/question-bag", label: "Question Bag" },
  { href: "/tests", label: "Tests" },
  { href: "/rooms", label: "Rooms" },
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-6 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <WorkspaceSwitcher current={current} workspaces={accessible} />
        <nav className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.map((item) => (
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
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
