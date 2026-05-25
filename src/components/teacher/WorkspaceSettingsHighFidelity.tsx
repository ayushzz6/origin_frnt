"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Users,
  BookOpen,
  CreditCard,
  Plus,
  Mail,
  Check,
  X,
  Copy,
  RotateCw,
  Lock,
  Trash2,
  Upload,
  Loader2,
  ExternalLink,
  MoreVertical,
  UserX,
  Unlock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherWorkspace, WorkspaceCode, WorkspaceMember, WorkspaceMemberRole } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  workspace: TeacherWorkspace;
  initialCodes: WorkspaceCode[];
  initialMembers: WorkspaceMember[];
  canEdit: boolean;
};

type TabType = "info" | "staff" | "ogcode" | "billing";

const ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  teacher: "Teacher",
  content_manager: "Content Manager",
  analyst: "Analyst",
  support: "Support"
};

export function WorkspaceSettingsHighFidelity({ workspace, initialCodes, initialMembers, canEdit }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [pending, startTransition] = useTransition();

  // Workspace Info State
  const [displayName, setDisplayName] = useState(workspace.displayName);
  const [legalName, setLegalName] = useState(workspace.legalName ?? "");
  const [city, setCity] = useState(workspace.city ?? "");
  const [state, setState] = useState(workspace.state ?? "");
  const [subjects, setSubjects] = useState((workspace.subjects ?? []).join(", "));
  const [logoPreview, setLogoPreview] = useState<string>("/origin-new.jpg"); // default logo reference

  // Join Codes State
  const [codes, setCodes] = useState<WorkspaceCode[]>(initialCodes);
  const [newCustomCode, setNewCustomCode] = useState("");
  const activeStudentCode = codes.find(c => c.codeType === "student_join" && c.status === "active");

  // Staff State
  const [members, setMembers] = useState<WorkspaceMember[]>(initialMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>("teacher");

  // OGCode State
  const [attributionName, setAttributionName] = useState(workspace.displayName || "ORIGIN Academy");
  const [mockPublications, setMockPublications] = useState([
    {
      id: "pub-1",
      questionStem: "If a point charge $q$ is placed at the center of a cube, what is the electric flux through one face?",
      subject: "Physics",
      chapter: "Electrostatics",
      status: "published",
      submittedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      notes: "Clean solution and perfect LaTeX equations."
    },
    {
      id: "pub-2",
      questionStem: "Find the limit: $\\lim_{x \\to 0} \\frac{\\sin x}{x}$.",
      subject: "Mathematics",
      chapter: "Limits",
      status: "changes_requested",
      submittedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      notes: "Please add a full solved solution explaining L'Hopital's rule."
    },
    {
      id: "pub-3",
      questionStem: "Identify the major product in the nitration of chlorobenzene.",
      subject: "Chemistry",
      chapter: "Organic Chemistry",
      status: "submitted",
      submittedAt: new Date().toISOString(),
      notes: null
    }
  ]);

  // Actions: Workspace settings update
  async function handleSaveSettings() {
    startTransition(async () => {
      const subjectList = subjects
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      const result = await apiJson(`/api/teacher/workspaces/${workspace.id}`, {
        method: "PATCH",
        json: {
          displayName: displayName.trim(),
          legalName: legalName.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          subjects: subjectList,
        },
      });
      if (result.ok) {
        toast.success("Workspace settings updated successfully!");
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to update workspace settings");
      }
    });
  }

  // Actions: Join code management
  async function handleRotateCode() {
    startTransition(async () => {
      const result = await apiJson<{ code: WorkspaceCode }>(
        `/api/teacher/workspaces/${workspace.id}/codes`,
        { method: "POST", json: { codeType: "student_join", rotate: true } }
      );
      if (result.ok) {
        toast.success("Join code rotated successfully!");
        refreshCodes();
      } else {
        toast.error("Failed to rotate code");
      }
    });
  }

  async function handleCreateCustomCode() {
    if (!newCustomCode.trim()) return;
    startTransition(async () => {
      const result = await apiJson<{ code: WorkspaceCode }>(
        `/api/teacher/workspaces/${workspace.id}/codes`,
        { method: "POST", json: { codeType: "student_join", rawDisplay: newCustomCode.trim() } }
      );
      if (result.ok) {
        toast.success(`Custom code "${newCustomCode}" registered!`);
        setNewCustomCode("");
        refreshCodes();
      } else {
        toast.error(result.detail || "Failed to create custom code");
      }
    });
  }

  async function handleRevokeCode(codeId: string) {
    startTransition(async () => {
      const result = await apiJson<{ code: WorkspaceCode }>(
        `/api/teacher/workspaces/${workspace.id}/codes/${codeId}/revoke`,
        { method: "POST", json: {} }
      );
      if (result.ok) {
        toast.success("Code revoked");
        refreshCodes();
      } else {
        toast.error("Failed to revoke code");
      }
    });
  }

  async function refreshCodes() {
    const refreshed = await apiJson<{ codes: WorkspaceCode[] }>(
      `/api/teacher/workspaces/${workspace.id}/codes`,
      { method: "GET" }
    );
    if (refreshed.ok) {
      setCodes(refreshed.data.codes);
    }
  }

  // Actions: Staff management
  async function handleInviteStaff() {
    if (!inviteEmail.trim()) return;
    startTransition(async () => {
      // Simulate inviting staff
      const mockNewMember: WorkspaceMember = {
        workspaceId: workspace.id,
        userId: `usr-${Math.random().toString(36).substr(2, 6)}`,
        role: inviteRole,
        status: "invited",
        invitedBy: "Owner",
        joinedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setMembers(prev => [...prev, mockNewMember]);
      toast.success(`Invitation email sent to ${inviteEmail}!`);
      setInviteOpen(false);
      setInviteEmail("");
    });
  }

  function handleDeactivateStaff(userId: string) {
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, status: "disabled" as const } : m));
    toast.info("Staff member access disabled");
  }

  function handleReactivateStaff(userId: string) {
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, status: "active" as const } : m));
    toast.success("Staff member access restored");
  }

  function handleRoleChange(userId: string, newRole: WorkspaceMemberRole) {
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    toast.success(`Role updated to ${ROLE_LABELS[newRole]}`);
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto items-start min-h-[75vh]">
      
      {/* SettingsNavTabs Sidebar */}
      <div className="w-full md:w-60 flex flex-row md:flex-col gap-1.5 border rounded-2xl bg-card p-2 shrink-0 md:sticky md:top-20">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left ${
            activeTab === "info" ? "bg-primary text-black" : "hover:bg-muted/10 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Workspace Info
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left ${
            activeTab === "staff" ? "bg-primary text-black" : "hover:bg-muted/10 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          Staff Directory
        </button>
        <button
          onClick={() => setActiveTab("ogcode")}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left ${
            activeTab === "ogcode" ? "bg-primary text-black" : "hover:bg-muted/10 text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          OGCode Publications
        </button>
        <button
          onClick={() => setActiveTab("billing")}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left ${
            activeTab === "billing" ? "bg-primary text-black" : "hover:bg-muted/10 text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          Billing & Quotas
        </button>
      </div>

      {/* Main Panels Content */}
      <div className="flex-1 w-full min-w-0">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Workspace Info */}
          {activeTab === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-base">Workspace Profile Details</CardTitle>
                  <CardDescription>Configure public academy descriptions, logos, and subjects.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo Attribution Builder */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 border-b pb-6">
                    <label htmlFor="settings-logo-upload" className="relative w-20 h-20 rounded-full border-2 border-primary/40 overflow-hidden bg-card group shrink-0 cursor-pointer block">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/40">
                          No Logo
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="w-4 h-4 text-white" />
                      </div>
                    </label>
                    <input
                      type="file"
                      id="settings-logo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setLogoPreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <div className="space-y-1 w-full text-center sm:text-left">
                      <h4 className="text-sm font-semibold">Academy Attribution Brand Logo</h4>
                      <p className="text-xs text-muted-foreground">This logo will be displayed next to your contributed questions in the public OGCode database.</p>
                      <div className="flex justify-center sm:justify-start gap-2 pt-2">
                        <label htmlFor="settings-logo-upload" className="cursor-pointer">
                          <span className="inline-flex items-center justify-center rounded-lg text-xs font-bold border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 transition-colors">
                            Upload New JPEG
                          </span>
                        </label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setLogoPreview("/origin-new.jpg")}
                          className="h-8 rounded-lg text-xs text-primary"
                        >
                          Reset to Default
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="displayName" className="text-xs font-bold">Display Name *</Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          disabled={!canEdit}
                          className="rounded-xl h-10 border-border/80"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="legalName" className="text-xs font-bold">Legal / Corporate Name</Label>
                        <Input
                          id="legalName"
                          value={legalName}
                          onChange={(e) => setLegalName(e.target.value)}
                          disabled={!canEdit}
                          className="rounded-xl h-10 border-border/80"
                          placeholder="Coaching Pvt. Ltd."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="city" className="text-xs font-bold">City</Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          disabled={!canEdit}
                          className="rounded-xl h-10 border-border/80"
                          placeholder="e.g. Pune"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="state" className="text-xs font-bold">State</Label>
                        <Input
                          id="state"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          disabled={!canEdit}
                          className="rounded-xl h-10 border-border/80"
                          placeholder="e.g. Maharashtra"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="subjects" className="text-xs font-bold">Subjects offered (comma separated)</Label>
                      <Input
                        id="subjects"
                        value={subjects}
                        onChange={(e) => setSubjects(e.target.value)}
                        disabled={!canEdit}
                        className="rounded-xl h-10 border-border/80"
                        placeholder="Physics, Chemistry, Mathematics"
                      />
                    </div>
                  </div>

                  {canEdit && (
                    <div className="pt-2 border-t">
                      <Button
                        onClick={handleSaveSettings}
                        disabled={pending}
                        className="bg-primary hover:bg-primary/95 text-black font-bold h-10 rounded-xl px-5"
                      >
                        {pending ? <Loader2 className="w-4 h-4 animate-spin shrink-0 mr-1.5" /> : null}
                        Save Settings
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Student Join Code management card */}
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-base">Workspace student join codes</CardTitle>
                  <CardDescription>Generate codes that allow student self-enrollment into this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {activeStudentCode ? (
                    <div className="flex items-center justify-between gap-3 border rounded-2xl bg-muted/20 px-4 py-3.5">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 rounded-md">
                          Active Key
                        </span>
                        <p className="font-mono text-lg font-extrabold tracking-widest text-foreground mt-1.5">
                          {activeStudentCode.displayCode}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Created on {new Date(activeStudentCode.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(activeStudentCode.displayCode);
                            toast.success("Join code copied to clipboard!");
                          }}
                          className="h-9 rounded-xl font-bold gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </Button>
                        {canEdit && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={pending}
                            onClick={handleRotateCode}
                            className="h-9 rounded-xl font-bold gap-1.5"
                          >
                            <RotateCw className="w-3.5 h-3.5" /> Rotate
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed rounded-2xl text-center text-xs text-muted-foreground">
                      No active join code found. Generate one below to begin onboarding.
                    </div>
                  )}

                  {canEdit && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-bold">Register Custom Workspace Code</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newCustomCode}
                          onChange={(e) => setNewCustomCode(e.target.value.toUpperCase())}
                          placeholder="e.g. ORIGIN-JEE-2026"
                          className="rounded-xl h-10 border-border/80"
                        />
                        <Button
                          onClick={handleCreateCustomCode}
                          disabled={pending || !newCustomCode.trim()}
                          className="bg-primary hover:bg-primary/95 text-black font-bold rounded-xl px-5 h-10 shrink-0"
                        >
                          Register Code
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Code History list */}
                  <div className="space-y-2 pt-4">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registration Code History</Label>
                    <div className="border rounded-2xl overflow-hidden divide-y bg-muted/5">
                      {codes.map((c) => (
                        <div key={c.id} className="p-3.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold tracking-wider text-sm">{c.displayCode}</span>
                            <div className="flex gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                              <span className="capitalize">{c.codeType.replace(/_/g, " ")}</span>
                              <span>·</span>
                              <span className={`capitalize ${c.status === "active" ? "text-emerald-500 font-bold" : ""}`}>
                                {c.status}
                              </span>
                              <span>·</span>
                              <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {c.status === "active" && canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => handleRevokeCode(c.id)}
                              className="h-8 rounded-lg text-destructive hover:bg-destructive/10"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 2: Staff Management */}
          {activeTab === "staff" && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <Card className="border">
                <CardHeader className="flex flex-row justify-between items-center">
                  <div>
                    <CardTitle className="text-base">Co-Teachers & Staff Roster</CardTitle>
                    <CardDescription>Grant dashboard controls to educators or support staff.</CardDescription>
                  </div>
                  {canEdit && (
                    <Button onClick={() => setInviteOpen(true)} className="bg-primary hover:bg-primary/95 text-black font-semibold rounded-xl h-9">
                      <Plus className="w-4 h-4 mr-1 shrink-0" /> Invite Staff
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="border rounded-2xl overflow-hidden overflow-x-auto bg-card">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b bg-muted/20 text-muted-foreground font-semibold uppercase tracking-wider">
                          <th className="p-3.5">User ID / Email</th>
                          <th className="p-3.5">Role</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                        {members.map((member) => (
                          <tr key={member.userId} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3.5 font-medium">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">{member.userId}</span>
                                {member.invitedBy && (
                                  <span className="text-[10px] text-muted-foreground font-normal mt-0.5">Invited by: {member.invitedBy}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5">
                              {canEdit && member.role !== "owner" ? (
                                <select
                                  value={member.role}
                                  onChange={(e) => handleRoleChange(member.userId, e.target.value as WorkspaceMemberRole)}
                                  className="h-8 rounded-lg border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-32"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="teacher">Teacher</option>
                                  <option value="content_manager">Content Manager</option>
                                  <option value="analyst">Analyst</option>
                                  <option value="support">Support</option>
                                </select>
                              ) : (
                                <span className="font-semibold text-xs capitalize">{ROLE_LABELS[member.role]}</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                member.status === "active"
                                  ? "bg-emerald-500/15 text-emerald-500"
                                  : member.status === "invited"
                                  ? "bg-amber-500/15 text-amber-500"
                                  : "bg-destructive/15 text-destructive"
                              }`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              {canEdit && member.role !== "owner" ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl">
                                    {member.status === "active" ? (
                                      <DropdownMenuItem onClick={() => handleDeactivateStaff(member.userId)} className="gap-2 text-destructive">
                                        <UserX className="w-4 h-4" /> Disable Access
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => handleReactivateStaff(member.userId)} className="gap-2 text-emerald-600 dark:text-emerald-400">
                                        <Unlock className="w-4 h-4" /> Reactivate Access
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <span className="text-muted-foreground select-none">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 3: OGCode Contribution */}
          {activeTab === "ogcode" && (
            <motion.div
              key="ogcode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Attribution builder */}
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-base">Attribution Name customization</CardTitle>
                  <CardDescription>The display name printed under your shared questions on the platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="attrName" className="text-xs font-bold">Contributor Attribution Name</Label>
                    <Input
                      id="attrName"
                      value={attributionName}
                      onChange={(e) => setAttributionName(e.target.value)}
                      placeholder="e.g. ORIGIN Academy Pune"
                      className="rounded-xl h-10 border-border/80"
                    />
                  </div>
                  <Button onClick={() => toast.success("Attribution profile details cached!")} className="bg-primary hover:bg-primary/95 text-black font-semibold h-9 rounded-xl px-4">
                    Update Profile
                  </Button>
                </CardContent>
              </Card>

              {/* Contribution History list */}
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-base">Community Pool publications history</CardTitle>
                  <CardDescription>Status tracking of questions contributed to the public OGCode database.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mockPublications.map((pub) => {
                    const isApproved = pub.status === "published";
                    const isDraft = pub.status === "draft";
                    const isSubmitted = pub.status === "submitted";
                    return (
                      <div key={pub.id} className="p-4 border rounded-2xl bg-card space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            isApproved
                              ? "bg-emerald-500/15 text-emerald-500"
                              : isSubmitted
                              ? "bg-blue-500/15 text-blue-500"
                              : pub.status === "changes_requested"
                              ? "bg-amber-500/15 text-amber-500 animate-pulse"
                              : "bg-destructive/15 text-destructive"
                          }`}>
                            {pub.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Submitted: {new Date(pub.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2 italic text-foreground/90">
                          {pub.questionStem}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t text-[10px] text-muted-foreground">
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 rounded bg-muted/40 font-semibold">{pub.subject}</span>
                            <span className="px-2 py-0.5 rounded bg-muted/40 font-semibold">{pub.chapter}</span>
                          </div>
                          {pub.notes && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <AlertCircle className="w-3.5 h-3.5" /> Moderation feedback comments
                            </span>
                          )}
                        </div>
                        {pub.notes && (
                          <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl text-xs text-amber-600 dark:text-amber-400 mt-2 select-text font-medium leading-relaxed">
                            {pub.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 4: Billing & Quotas */}
          {activeTab === "billing" && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Subscription details */}
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-base">Subscription Plan</CardTitle>
                  <CardDescription>Current quota settings and Billing details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-2xl bg-muted/10 gap-4">
                    <div>
                      <span className="bg-primary/20 text-primary border border-primary/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                        Premium Academy Tier
                      </span>
                      <h3 className="text-lg font-bold tracking-tight mt-1.5">ORIGIN Professional Plan</h3>
                      <p className="text-xs text-muted-foreground">Renews automatically on Oct 1, 2026</p>
                    </div>
                    <Button variant="outline" className="h-10 rounded-xl font-bold flex gap-1 items-center">
                      Upgrade Tier <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </div>

                  {/* Quotas Progress bar */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Workspace Quotas</h4>
                    
                    {/* Student Quota */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Students Enrolled</span>
                        <span className="text-muted-foreground"><span className="font-bold text-foreground">148</span> / 500 Active</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "30%" }} />
                      </div>
                    </div>

                    {/* Question Storage */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Questions stored in Bag</span>
                        <span className="text-muted-foreground"><span className="font-bold text-foreground">1,240</span> / 5,000 Questions</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "25%" }} />
                      </div>
                    </div>

                    {/* Active Live Rooms */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Active Monthly Live Rooms</span>
                        <span className="text-muted-foreground"><span className="font-bold text-foreground">18</span> / 50 Rooms</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "36%" }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoices list */}
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-base">Billing & Invoice History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-2xl overflow-hidden bg-card text-xs">
                    <div className="p-3.5 border-b bg-muted/20 flex justify-between font-semibold text-muted-foreground uppercase">
                      <span>Invoice details</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y">
                      <div className="p-3.5 flex justify-between items-center">
                        <div>
                          <p className="font-bold">ORIGIN Pro Plan (Monthly)</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">May 1, 2026 · Invoice #ORG-9831</p>
                        </div>
                        <span className="font-bold">$49.00</span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center">
                        <div>
                          <p className="font-bold">ORIGIN Pro Plan (Monthly)</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Apr 1, 2026 · Invoice #ORG-9238</p>
                        </div>
                        <span className="font-bold">$49.00</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Manual Invite Staff Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
            <DialogDescription>
              Grant co-teachers, analysts, or managers access permission to this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Staff Email Address</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@academy.com"
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Permissions Role</Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceMemberRole)}
                className="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="admin">Admin (Full Control)</option>
                <option value="teacher">Teacher (Classroom & Planner)</option>
                <option value="content_manager">Content Manager (Questions Bank)</option>
                <option value="analyst">Analyst (Analytics reports only)</option>
                <option value="support">Support (Operations support)</option>
              </select>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="rounded-xl flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleInviteStaff}
              disabled={pending || !inviteEmail.trim()}
              className="bg-primary hover:bg-primary/95 text-black font-bold rounded-xl flex-1 gap-1.5"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
