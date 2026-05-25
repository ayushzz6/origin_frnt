"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  ShieldAlert, 
  CheckSquare, 
  Search, 
  Power, 
  LogOut, 
  Gauge, 
  Check, 
  X, 
  AlertOctagon,
  Download,
  AlertTriangle,
  ArrowRight,
  Globe,
  Loader2,
  MoreVertical
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { FormattedMessage } from "@/components/origin-ai/FormattedMessage";
import { apiJson } from "@/lib/teacher-client";
import type { WorkspaceAdminSummary, OgcodePublicationWithQuestion } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  initialWorkspaces: WorkspaceAdminSummary[];
  pendingPublications: OgcodePublicationWithQuestion[];
};

type ActiveSubTab = "workspaces" | "queue" | "incidents";

export function AdminModerationDashboard({ initialWorkspaces, pendingPublications: initialQueue }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveSubTab>("workspaces");
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceAdminSummary[]>(initialWorkspaces);
  const [queue, setQueue] = useState<OgcodePublicationWithQuestion[]>(initialQueue);
  const [pending, startTransition] = useTransition();

  // Filter workspaces
  const filteredWorkspaces = workspaces.filter(w => {
    if (searchQuery.trim()) {
      return w.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || w.ownerEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Mock moderation queue if empty for demonstration
  const displayQueue = queue.length > 0 ? queue : [
    {
      id: "pub-mock-1",
      questionId: "q-1",
      questionVersionId: "v-1",
      contributorWorkspaceId: "w-1",
      contributorUserId: "u-1",
      attributionName: "Physics Catalyst Academy",
      attributionLogoAssetId: null,
      status: "submitted" as const,
      version: 1,
      moderationNotes: null,
      submittedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      publishedAt: null,
      archivedAt: null,
      supersededBy: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questionStem: "Determine the magnetic moment $\\vec{M}$ of a loop carrying a steady current $I$ around a hemisphere of radius $R$:",
      questionSubject: "Physics",
      questionChapter: "Magnetism"
    }
  ];

  // Actions
  async function handleSuspendWorkspace(workspaceId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/admin/workspaces/${workspaceId}`,
        {
          method: "POST",
          json: { action: "suspend", reason: "policy_violation", notes: "Administrative suspension trigger" }
        }
      );
      if (result.ok) {
        toast.success("Workspace suspended successfully!");
        setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, status: "suspended" } : w));
        router.refresh();
      } else {
        toast.error("Failed to suspend workspace");
      }
    });
  }

  async function handleUnsuspendWorkspace(workspaceId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/admin/workspaces/${workspaceId}`,
        {
          method: "POST",
          json: { action: "unsuspend" }
        }
      );
      if (result.ok) {
        toast.success("Workspace reinstated to active status");
        setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, status: "active" } : w));
        router.refresh();
      } else {
        toast.error("Failed to unsuspend workspace");
      }
    });
  }

  async function handleApproveOGCode(publicationId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/admin/ogcode/moderation/${publicationId}/approve`,
        { method: "POST", json: {} }
      );
      if (result.ok) {
        toast.success("Contributed question approved & synchronized to public pool!");
        setQueue(prev => prev.filter(p => p.id !== publicationId));
        router.refresh();
      } else {
        toast.error("Failed to approve publication");
      }
    });
  }

  async function handleRejectOGCode(publicationId: string) {
    const reason = prompt("Enter moderation rejection reason:") || "";
    if (!reason.trim()) return;

    startTransition(async () => {
      const result = await apiJson(
        `/api/admin/ogcode/moderation/${publicationId}/reject`,
        { method: "POST", json: { reason } }
      );
      if (result.ok) {
        toast.warning("Contributed question rejected. Attribution notes sent.");
        setQueue(prev => prev.filter(p => p.id !== publicationId));
        router.refresh();
      } else {
        toast.error("Failed to reject publication");
      }
    });
  }

  async function handleTriggerKillSwitch(action: "kill_switch" | "force_logout" | "rate_limit") {
    if (!confirm(`Are you absolutely sure you want to execute system action: ${action.replace(/_/g, " ").toUpperCase()}?`)) return;
    
    startTransition(async () => {
      const result = await apiJson(
        `/api/admin/incidents/${action}`,
        { method: "POST", json: {} }
      );
      if (result.ok) {
        toast.success(`Platform incident action: ${action.toUpperCase()} completed successfully.`);
      } else {
        toast.error("Emergency command execution failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      
      {/* PlatformMetricsRow */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Total Workspaces
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{workspaces.length}</span>
              <span className="text-[10px] text-muted-foreground font-semibold">Active & Suspended</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5" /> Moderation Queue
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{displayQueue.length} Pending</span>
              <span className="text-[10px] text-primary font-bold">OGCode Review</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Active Incidents
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-destructive">0 Alert Logs</span>
              <span className="text-[10px] text-emerald-500 font-bold">Systems Normal</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b shrink-0">
        <Button 
          variant="ghost"
          onClick={() => setActiveTab("workspaces")}
          className={`h-11 px-6 rounded-none border-b-2 font-bold ${
            activeTab === "workspaces" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Coaching Workspaces
        </Button>
        <Button 
          variant="ghost"
          onClick={() => setActiveTab("queue")}
          className={`h-11 px-6 rounded-none border-b-2 font-bold ${
            activeTab === "queue" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          OGCode Moderation ({displayQueue.length})
        </Button>
        <Button 
          variant="ghost"
          onClick={() => setActiveTab("incidents")}
          className={`h-11 px-6 rounded-none border-b-2 font-bold ${
            activeTab === "incidents" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          System Kill-Switches
        </Button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "workspaces" && (
          <div className="space-y-4 animate-fade-in">
            {/* Search filter */}
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspaces by name or owner..."
                className="pl-9 h-10 rounded-xl"
              />
            </div>

            {/* WorkspaceRosterDirectory */}
            <div className="border rounded-2xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="p-4">Academy Name</th>
                      <th className="p-4">Owner / Contact</th>
                      <th className="p-4">Student Count</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 w-28 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {filteredWorkspaces.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{w.displayName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{w.id}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span>{w.ownerName || "—"}</span>
                            <span className="text-[10px] text-muted-foreground">{w.ownerEmail || "—"}</span>
                          </div>
                        </td>
                        <td className="p-4 font-semibold">{w.studentCount} Students</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 border rounded-full ${
                            w.status === "active" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" : "bg-destructive/15 text-destructive border-destructive/20"
                          }`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              {w.status === "active" ? (
                                <DropdownMenuItem onClick={() => handleSuspendWorkspace(w.id)} className="text-destructive font-medium">
                                  Suspend Workspace
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleUnsuspendWorkspace(w.id)} className="text-emerald-500 font-medium">
                                  Reinstate Workspace
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="gap-2">
                                <Download className="w-4 h-4" /> Export schema JSON
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "queue" && (
          <div className="space-y-4 animate-fade-in">
            {displayQueue.map((pub) => (
              /* OGCodeModerationQueueCard */
              <Card key={pub.id} className="border bg-card">
                <CardHeader className="pb-3 border-b flex flex-row justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary border rounded-md font-mono">
                        {pub.questionSubject?.toUpperCase()}
                      </span>
                      <span>{pub.questionChapter}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Attribution: <span className="font-semibold text-foreground">{pub.attributionName}</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleApproveOGCode(pub.id)}
                      disabled={pending}
                      className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-9 rounded-xl gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                    <Button 
                      onClick={() => handleRejectOGCode(pub.id)}
                      disabled={pending}
                      className="bg-destructive hover:bg-destructive/90 text-white font-bold h-9 rounded-xl gap-1.5"
                    >
                      <X className="w-4 h-4" /> Request Changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="prose dark:prose-invert max-w-none text-xs bg-muted/10 p-4 rounded-xl border select-text">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-2">Question Stem Preview</p>
                    <FormattedMessage content={pub.questionStem || ""} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "incidents" && (
          <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
            {/* IncidentKillSwitchConsole */}
            <Card className="border border-destructive/20 bg-destructive/[0.01]">
              <CardHeader className="text-center pb-2">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2">
                  <AlertOctagon className="w-6 h-6 animate-pulse" />
                </div>
                <CardTitle className="text-destructive text-lg font-bold">Emergency Cockpit Control</CardTitle>
                <CardDescription>
                  High-priority operations that affect system-wide telemetry.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 border border-amber-500/20 bg-amber-500/10 rounded-xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Caution:</span> Executing emergency kill switches force-closes active proctor rooms and terminates database order streams immediately.
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Button 
                    onClick={() => handleTriggerKillSwitch("kill_switch")}
                    variant="destructive"
                    className="w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Power className="w-5 h-5" /> Execute Platform Kill-Switch
                  </Button>
                  <Button 
                    onClick={() => handleTriggerKillSwitch("force_logout")}
                    variant="outline"
                    className="w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="w-5 h-5" /> Force Logout All Active Users
                  </Button>
                  <Button 
                    onClick={() => handleTriggerKillSwitch("rate_limit")}
                    variant="outline"
                    className="w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 border-border/80"
                  >
                    <Gauge className="w-5 h-5" /> Enforce Restrictive API Rate Limits
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

    </div>
  );
}
