"use client";

/**
 * Teacher profile route — audit fix R-3 (A-10).
 *
 * Mounts the existing TeacherProfile section under a real route so the
 * "Profile" link in TeacherTopbar resolves. Previously TeacherProfile.tsx
 * was orphaned dead code with no entry point.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import TeacherProfile from "@/sections/TeacherProfile";
import { useAuth } from "@/context/AuthContext";

export default function TeacherProfilePage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth?role=teacher&next=/teacher/profile");
    }
    if (!isLoading && user && user.role !== "teacher" && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("[teacher-profile] logout failed:", error);
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <TeacherProfile
      user={user}
      onBack={() => router.push("/teacher")}
      onLogout={handleLogout}
    />
  );
}
