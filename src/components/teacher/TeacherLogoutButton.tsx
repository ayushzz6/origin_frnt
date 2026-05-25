'use client';

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth-actions";

export function TeacherLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logoutAction();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <Button 
        onClick={handleLogout} 
        variant="outline" 
        className="flex items-center gap-2 border-border/80 bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 rounded-xl px-4 h-10 shadow-lg text-xs font-bold transition-all duration-300"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </div>
  );
}
