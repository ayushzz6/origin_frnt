"use client";

/**
 * TeacherTopbar — fixes audit findings A-10 (no logout on teacher
 * surface) and A-11 (no marketplace entry from the teacher chrome).
 *
 * Sits inside the workspace layout next to WorkspaceSwitcher. Provides:
 *   - avatar dropdown → Profile · Marketplace · Theme · Sign out
 *   - the only path out of the teacher shell short of clearing cookies
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { LogOut, User as UserIcon, Store, Sun, Moon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

type Props = {
  workspaceId: string;
  /**
   * If false (the marketplace flag is off) the Marketplace link is
   * hidden. We still render the topbar so logout/profile remain reachable.
   */
  marketplaceEnabled: boolean;
};

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function TeacherTopbar({ workspaceId, marketplaceEnabled }: Props) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } catch (error) {
      console.error("[teacher-topbar] logout failed:", error);
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-semibold">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:inline">
            {user?.name ?? "Teacher"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.name ?? "Teacher"}</span>
            {user?.email && (
              <span className="text-xs text-muted-foreground">{user.email}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/teacher/profile" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        {marketplaceEnabled && (
          <DropdownMenuItem asChild>
            <Link
              href={`/teacher/workspaces/${workspaceId}/offerings`}
              className="flex items-center gap-2"
            >
              <Store className="h-4 w-4" />
              <span>Marketplace</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={toggleTheme} className="flex items-center gap-2">
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="flex items-center gap-2 text-rose-600 focus:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
