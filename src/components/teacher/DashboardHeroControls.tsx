"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Share2, RefreshCw, Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";
import type { WorkspaceCode } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  activeCode: WorkspaceCode | null;
};

export function DashboardHeroControls({ workspaceId, activeCode }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const codeString = activeCode?.displayCode || "NO-ACTIVE-CODE";
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/join?code=${codeString}` : "";

  function copyCode() {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const text = `Join my ORIGIN learning workspace using this code: *${codeString}* or click here: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function rotateCode() {
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/codes`,
        { 
          method: "POST", 
          json: { codeType: "student_join", rotate: true } 
        }
      );
      if (result.ok) {
        toast.success("Workspace code rotated successfully!");
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to rotate code");
      }
    });
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
      <div className="flex items-center gap-2 px-4 py-2 border rounded-xl bg-card w-full sm:w-auto justify-between sm:justify-start">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Join Code:</span>
        <span className="font-mono font-bold text-primary text-lg tracking-widest">{codeString}</span>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={copyCode} 
          disabled={!activeCode}
          className="flex-1 sm:flex-initial gap-1.5 h-10 rounded-xl"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          Copy
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={shareWhatsApp} 
          disabled={!activeCode}
          className="flex-1 sm:flex-initial gap-1.5 h-10 rounded-xl hover:text-emerald-500 hover:border-emerald-500/30"
        >
          <MessageSquare className="w-4 h-4" />
          Share
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={rotateCode} 
          disabled={pending || !activeCode}
          className="flex-1 sm:flex-initial gap-1.5 h-10 rounded-xl"
        >
          <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin text-primary" : ""}`} />
          Rotate
        </Button>
      </div>
    </div>
  );
}
