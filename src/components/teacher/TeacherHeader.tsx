"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  Store,
  User as UserIcon,
  LogOut,
  Sun,
  Moon,
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  ChevronRight
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import type { WorkspaceMembershipSummary, WorkspaceMember } from "@/server/workspaces/types";

type NavItem = { href: string; label: string; flag?: "paidEnrollment" };

type Props = {
  workspaceId: string;
  current: WorkspaceMembershipSummary;
  workspaces: WorkspaceMembershipSummary[];
  visibleNavItems: NavItem[];
  isPlatformAdmin: boolean;
  membership: WorkspaceMember | null;
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

export function TeacherHeader({
  workspaceId,
  current,
  workspaces,
  visibleNavItems,
  isPlatformAdmin,
  membership,
  marketplaceEnabled,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await logout();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("[TeacherHeader] logout failed:", error);
    }
  };

  // Define primary mobile tabs (Overview, Students, Batches, Tests)
  const mobilePrimaryTabs = [
    { href: "", label: "Overview", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: Users },
    { href: "/batches", label: "Batches", icon: BookOpen },
    { href: "/tests", label: "Tests", icon: FileText },
  ];

  // The remaining tabs for the bottom drawer
  const bottomDrawerTabs = visibleNavItems.filter(
    (item) => !mobilePrimaryTabs.some((tab) => tab.href === item.href)
  );

  return (
    <>
      {/* 1. TOP HEADER BAR (Desktop switcher, nav and mobile layout header) */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          
          {/* Left Section: Switcher & Desktop Navigation */}
          <div className="flex items-center gap-6">
            <WorkspaceSwitcher current={current} workspaces={workspaces} />
            
            {/* Desktop Nav Items */}
            <nav className="hidden lg:flex items-center gap-1">
              {visibleNavItems.map((item) => {
                const fullHref = `/teacher/workspaces/${workspaceId}${item.href}`;
                const isActive =
                  item.href === ""
                    ? pathname === `/teacher/workspaces/${workspaceId}`
                    : pathname.startsWith(fullHref);

                return (
                  <Link
                    key={item.label}
                    href={fullHref}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section: Sells/Admin badges & User tools */}
          <div className="flex items-center gap-4">
            {/* Admin Override Badge (Desktop) */}
            {isPlatformAdmin && !membership && (
              <span className="hidden sm:inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                Platform Admin
              </span>
            )}

            {/* Desktop Tools */}
            <div className="hidden lg:flex items-center gap-2">
              <ThemeToggle />
              
              {/* Avatar block with link directly to profile */}
              <Link href="/teacher/profile" className="flex items-center gap-2 hover:opacity-90">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold border border-primary/20">
                  {initials(user?.name)}
                </div>
                <span className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline">
                  {user?.name ?? "Teacher"}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg border transition-all"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile Header Right Profile shortcut */}
            <Link href="/teacher/profile" className="lg:hidden flex items-center">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                {initials(user?.name)}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t bg-background/80 backdrop-blur-lg px-2 py-2 pb-safe shadow-lg shadow-black/10 dark:shadow-white/5">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {mobilePrimaryTabs.map((tab) => {
            const fullHref = `/teacher/workspaces/${workspaceId}${tab.href}`;
            const isActive =
              tab.href === ""
                ? pathname === `/teacher/workspaces/${workspaceId}`
                : pathname.startsWith(fullHref) && !menuOpen;

            const Icon = tab.icon;

            return (
              <Link
                key={tab.label}
                href={fullHref}
                onClick={() => setMenuOpen(false)}
                className={`flex flex-col items-center justify-center gap-1 w-16 py-1 rounded-xl transition-all relative ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-dot"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                )}
              </Link>
            );
          })}

          {/* More Toggle Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`flex flex-col items-center justify-center gap-1 w-16 py-1 rounded-xl transition-all relative ${
              menuOpen
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="text-[10px] font-bold tracking-tight">{menuOpen ? "Close" : "More"}</span>
          </button>
        </div>
      </div>

      {/* 3. MOBILE BOTTOM SHEET DRAWER OVERLAY */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />

            {/* Bottom Drawer Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="fixed bottom-16 left-0 right-0 z-40 lg:hidden bg-card rounded-t-3xl border-t border-border/85 shadow-2xl p-4 max-h-[75vh] overflow-y-auto pb-10"
            >
              {/* Drag Handle Indicator */}
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
              
              <div className="px-2 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Other Features</h3>
              </div>

              {/* Drawer Links */}
              <div className="flex flex-col gap-1 mb-4">
                {bottomDrawerTabs.map((item) => {
                  const fullHref = `/teacher/workspaces/${workspaceId}${item.href}`;
                  const isActive =
                    item.href === ""
                      ? pathname === `/teacher/workspaces/${workspaceId}`
                      : pathname.startsWith(fullHref);

                  return (
                    <Link
                      key={item.label}
                      href={fullHref}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </Link>
                  );
                })}
              </div>

              {/* System/Profile Actions */}
              <div className="border-t pt-4 flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2">Settings & Profile</h3>
                
                {/* Admin Override Badge */}
                {isPlatformAdmin && !membership && (
                  <div className="mx-2 px-4 py-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-between">
                    <span>Override Status</span>
                    <span>Platform Admin</span>
                  </div>
                )}

                {/* Profile Link */}
                <Link
                  href="/teacher/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-accent text-sm font-bold text-muted-foreground hover:text-foreground"
                >
                  <UserIcon className="h-4.5 w-4.5" />
                  <span>My Profile</span>
                </Link>

                {/* Marketplace Link */}
                {marketplaceEnabled && (
                  <Link
                    href={`/teacher/workspaces/${workspaceId}/offerings`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-accent text-sm font-bold text-muted-foreground hover:text-foreground"
                  >
                    <Store className="h-4.5 w-4.5" />
                    <span>Marketplace</span>
                  </Link>
                )}

                {/* Theme Toggle Button */}
                <button
                  onClick={() => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  }}
                  className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl hover:bg-accent text-sm font-bold text-muted-foreground hover:text-foreground"
                >
                  <div className="flex items-center gap-3">
                    {resolvedTheme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
                    <span>Theme</span>
                  </div>
                  <span className="text-xs capitalize font-medium text-muted-foreground">{resolvedTheme} mode</span>
                </button>

                {/* Log out Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl hover:bg-rose-500/10 hover:text-rose-500 text-sm font-bold text-rose-500/80 transition-colors"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
