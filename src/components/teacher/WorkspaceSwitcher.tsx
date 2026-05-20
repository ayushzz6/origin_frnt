"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceMembershipSummary } from "@/server/workspaces/types";

type Props = {
  current: WorkspaceMembershipSummary;
  workspaces: WorkspaceMembershipSummary[];
};

export function WorkspaceSwitcher({ current, workspaces }: Props) {
  const [open, setOpen] = useState(false);
  if (workspaces.length <= 1) {
    return (
      <div className="rounded-md border bg-background px-3 py-2 text-sm font-medium">
        {current.displayName}
        <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
          {current.workspaceType}
        </span>
      </div>
    );
  }
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between">
          <span className="truncate">{current.displayName}</span>
          <span className="ml-2 text-xs uppercase text-muted-foreground">
            {current.workspaceType}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem asChild key={w.id}>
            <Link href={`/teacher/workspaces/${w.id}`} className="flex flex-col">
              <span className="text-sm font-medium">{w.displayName}</span>
              <span className="text-xs text-muted-foreground">
                {w.workspaceType} · {w.role}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/teacher">All workspaces</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
