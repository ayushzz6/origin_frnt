"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpen, 
  FileSpreadsheet, 
  FileText, 
  Upload, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  HelpCircle, 
  Plus, 
  Trash2,
  Calendar,
  AlertCircle,
  FileIcon,
  Download,
  Loader2,
  Link as LinkIcon,
  ExternalLink
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BatchChat } from "@/components/batch/BatchChat";
import { apiJson } from "@/lib/teacher-client";
import type { Batch, StudyMaterialWithAssets, AssessmentTest } from "@/server/workspaces/types";
import type { SyllabusTree, SyllabusStatus } from "@/server/workspaces/syllabus-store";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  batch: Batch;
  materials: StudyMaterialWithAssets[];
  tests: AssessmentTest[];
  syllabus: SyllabusTree | null;
  canManage: boolean;
};

type ActiveTab = "syllabus" | "tests" | "materials" | "messages";

export function BatchPlannerHighFidelity({ workspaceId, batch, materials: initialMaterials, tests, syllabus: initialSyllabus, canManage }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("syllabus");
  const [materials, setMaterials] = useState(initialMaterials);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Real, teacher-authored syllabus tree (progress derived from student mastery).
  const [syllabus, setSyllabus] = useState<SyllabusTree | null>(initialSyllabus);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(initialSyllabus?.chapters[0] ? [initialSyllabus.chapters[0].id] : []),
  );
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [addingTopicFor, setAddingTopicFor] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState("");

  const progress = syllabus?.progress ?? { percent: 0, mastered: 0, inProgress: 0, unstarted: 0, total: 0 };
  const progressPercent = progress.percent;
  const syllabusSubject = syllabus?.subject || batch.subject || "General";

  const syllabusBase = `/api/teacher/workspaces/${workspaceId}/batches/${batch.id}/syllabus`;

  async function refreshSyllabus() {
    const result = await apiJson<{ tree: SyllabusTree }>(syllabusBase, { method: "GET" });
    if (result.ok) setSyllabus(result.data.tree);
  }

  function addChapter() {
    const title = newChapterTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const result = await apiJson(syllabusBase, {
        method: "POST",
        json: { kind: "chapter", title, subject: batch.subject ?? null },
      });
      if (result.ok) {
        setNewChapterTitle("");
        await refreshSyllabus();
      } else {
        toast.error(result.detail || "Failed to add chapter");
      }
    });
  }

  function addTopic(chapterId: string) {
    const title = newTopicTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const result = await apiJson(syllabusBase, {
        method: "POST",
        json: { kind: "topic", title, parentId: chapterId },
      });
      if (result.ok) {
        setNewTopicTitle("");
        setAddingTopicFor(null);
        await refreshSyllabus();
      } else {
        toast.error(result.detail || "Failed to add topic");
      }
    });
  }

  function deleteNode(nodeId: string, label: string) {
    if (!confirm(`Delete "${label}"? Topics inside a chapter are removed too.`)) return;
    startTransition(async () => {
      const result = await apiJson(`${syllabusBase}/${nodeId}`, { method: "DELETE" });
      if (result.ok) await refreshSyllabus();
      else toast.error(result.detail || "Failed to delete");
    });
  }

  function setTopicStatus(nodeId: string, manualStatus: SyllabusStatus) {
    startTransition(async () => {
      const result = await apiJson(`${syllabusBase}/${nodeId}`, {
        method: "PATCH",
        json: { manualStatus },
      });
      if (result.ok) await refreshSyllabus();
      else toast.error(result.detail || "Failed to update status");
    });
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const materialsBase = `/api/teacher/workspaces/${workspaceId}/batches/${batch.id}/materials`;
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  async function refreshMaterials() {
    const refreshed = await apiJson<{ materials: StudyMaterialWithAssets[] }>(materialsBase, { method: "GET" });
    if (refreshed.ok) setMaterials(refreshed.data.materials);
  }

  // Real upload: file bytes go to Cloudflare R2, metadata to Postgres, assigned to this batch.
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const result = await apiJson<{ material: StudyMaterialWithAssets }>(materialsBase, { method: "POST", body: form });
      if (result.ok) {
        toast.success("Study material uploaded to the batch.");
        await refreshMaterials();
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to upload study material");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleAddLink() {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Enter a valid http(s) link.");
      return;
    }
    startTransition(async () => {
      const result = await apiJson<{ material: StudyMaterialWithAssets }>(materialsBase, {
        method: "POST",
        json: { linkUrl: url, title: linkTitle.trim() || undefined },
      });
      if (result.ok) {
        toast.success("Link shared with the batch.");
        setLinkUrl("");
        setLinkTitle("");
        await refreshMaterials();
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to share link");
      }
    });
  }

  async function handleDeleteMaterial(materialId: string) {
    if (!confirm("Are you sure you want to delete this study material?")) return;
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/study-materials/${materialId}`,
        { method: "DELETE" }
      );
      if (result.ok) {
        toast.success("Study material deleted");
        setMaterials(prev => prev.filter(m => m.id !== materialId));
        router.refresh();
      } else {
        toast.error("Failed to delete study material");
      }
    });
  }

  return (
    <div className="space-y-6">
      
      {/* SyllabusProgressRing Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-6 border rounded-2xl bg-card">
        <div className="flex flex-col items-center justify-center p-2">
          {/* Radial HSL Completion ring */}
          <div className="relative w-28 h-28 rounded-full border-4 border-muted flex flex-col items-center justify-center font-bold">
            <span className="text-2xl">{progressPercent}%</span>
            <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">Complete</span>
            <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.07]">
              <circle 
                cx="56" 
                cy="56" 
                r="52" 
                fill="transparent" 
                stroke="#38bdf8" 
                strokeWidth="5" 
                strokeDasharray="327" 
                strokeDashoffset={327 - (327 * progressPercent) / 100}
                className="transition-all duration-700"
              />
            </svg>
          </div>
        </div>

        <div className="md:col-span-2 space-y-3 text-center md:text-left">
          <h3 className="font-semibold text-lg flex items-center justify-center md:justify-start gap-1.5">
            <BookOpen className="w-5 h-5 text-primary" /> Syllabus Progress: {progressPercent}%
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            This batch is covering the subject: <span className="font-bold text-foreground">{syllabusSubject}</span>.
            {progress.total === 0
              ? " Build the syllabus tree below to start tracking topic mastery."
              : " Progress is derived from your students' topic mastery; mark a topic manually to override."}
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start text-xs font-semibold">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {progress.mastered} Mastered
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              {progress.inProgress} In Progress
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
              {progress.unstarted} Unstarted
            </span>
          </div>
        </div>
      </div>

      {/* PlannerTabSystem */}
      <div className="flex border-b">
        <Button 
          variant="ghost"
          onClick={() => setActiveTab("syllabus")}
          className={`h-11 px-6 rounded-none border-b-2 font-bold ${
            activeTab === "syllabus" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Syllabus Tree
        </Button>
        <Button 
          variant="ghost"
          onClick={() => setActiveTab("tests")}
          className={`h-11 px-6 rounded-none border-b-2 font-bold ${
            activeTab === "tests" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Mock Tests ({tests.length})
        </Button>
        <Button 
          variant="ghost"
          onClick={() => setActiveTab("materials")}
          className={`h-11 px-6 rounded-none border-b-2 font-bold ${
            activeTab === "materials" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Study Materials ({materials.length})
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab("messages")}
          className={`h-11 px-6 rounded-none border-b-2 font-bold ${
            activeTab === "messages" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Messages
        </Button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "syllabus" && (
          <div className="space-y-4 animate-fade-in">
            {canManage && (
              <div className="flex gap-2">
                <Input
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChapter()}
                  placeholder="Add a chapter (e.g. Rotational Mechanics)"
                  className="h-9 rounded-xl text-sm"
                />
                <Button onClick={addChapter} disabled={pending || !newChapterTitle.trim()} className="h-9 rounded-xl gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" /> Chapter
                </Button>
              </div>
            )}

            {(syllabus?.chapters.length ?? 0) === 0 ? (
              <div className="p-8 border border-dashed rounded-2xl text-center text-sm text-muted-foreground">
                No syllabus yet. {canManage ? "Add a chapter above to begin." : "The teacher hasn't built the syllabus yet."}
              </div>
            ) : (
              syllabus?.chapters.map((chapter) => {
                const isOpen = expandedChapters.has(chapter.id);
                return (
                  <div key={chapter.id} className="border rounded-2xl overflow-hidden bg-card transition-all">
                    <div className="flex justify-between items-center p-4 hover:bg-muted/10 transition-colors">
                      <button onClick={() => toggleChapter(chapter.id)} className="flex items-center gap-2 font-semibold text-sm text-left flex-1">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {chapter.title}
                        <span className="text-[10px] text-muted-foreground font-normal">({chapter.topics.length})</span>
                      </button>
                      {canManage && (
                        <Button variant="ghost" size="icon" disabled={pending} onClick={() => deleteNode(chapter.id, chapter.title)} className="h-7 w-7 rounded-full text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {isOpen && (
                      <div className="border-t p-4 space-y-2 bg-muted/5">
                        {chapter.topics.map((topic) => (
                          <div key={topic.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                            <span className="font-medium flex items-center gap-2">
                              {topic.status === "mastered" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                : topic.status === "in_progress" ? <Clock className="w-4 h-4 text-amber-500" />
                                : <HelpCircle className="w-4 h-4 text-muted-foreground" />}
                              {topic.title}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {topic.accuracy !== null && (
                                <span className="text-xs text-muted-foreground font-mono">{Math.round(topic.accuracy)}%</span>
                              )}
                              {canManage ? (
                                <select
                                  value={topic.manualStatus ?? "auto"}
                                  disabled={pending}
                                  onChange={(e) => setTopicStatus(topic.id, e.target.value === "auto" ? ("unstarted" as SyllabusStatus) : (e.target.value as SyllabusStatus))}
                                  className="text-[10px] rounded-md border bg-background px-1.5 py-0.5"
                                  title="Override status"
                                >
                                  <option value="auto">{topic.status}</option>
                                  <option value="mastered">mastered</option>
                                  <option value="in_progress">in_progress</option>
                                  <option value="unstarted">unstarted</option>
                                </select>
                              ) : (
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  topic.status === "mastered" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    : topic.status === "in_progress" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                    : "bg-muted text-muted-foreground border"
                                }`}>{topic.status}</span>
                              )}
                              {canManage && (
                                <Button variant="ghost" size="icon" disabled={pending} onClick={() => deleteNode(topic.id, topic.title)} className="h-6 w-6 rounded-full text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {chapter.topics.length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">No topics yet.</p>
                        )}
                        {canManage && (
                          addingTopicFor === chapter.id ? (
                            <div className="flex gap-2 pt-1">
                              <Input
                                value={newTopicTitle}
                                onChange={(e) => setNewTopicTitle(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addTopic(chapter.id)}
                                placeholder="Topic name"
                                autoFocus
                                className="h-8 rounded-lg text-xs"
                              />
                              <Button size="sm" disabled={pending || !newTopicTitle.trim()} onClick={() => addTopic(chapter.id)} className="h-8 rounded-lg">Add</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setAddingTopicFor(null); setNewTopicTitle(""); }} className="h-8 rounded-lg">Cancel</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => { setAddingTopicFor(chapter.id); setNewTopicTitle(""); }} className="h-8 rounded-lg gap-1.5 text-muted-foreground">
                              <Plus className="w-3.5 h-3.5" /> Add topic
                            </Button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "tests" && (
          <div className="space-y-4 animate-fade-in">
            {tests.length === 0 ? (
              <div className="p-8 border border-dashed rounded-2xl text-center text-muted-foreground">
                No mock tests scheduled for this batch yet.
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1">
                {tests.map((test) => (
                  <div key={test.id} className="p-4 border rounded-xl flex items-center justify-between bg-card hover:border-primary/20 transition-all">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">{test.title}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{test.durationMinutes} mins</span>
                        <span>·</span>
                        <span>{test.totalQuestions} questions</span>
                        <span>·</span>
                        <span className="capitalize font-medium">{test.difficulty}</span>
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      test.status === "live" 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse" 
                        : "bg-muted text-muted-foreground border"
                    }`}>
                      {test.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "materials" && (
          <div className="space-y-4 animate-fade-in">
            {/* StudyMaterialsUploader */}
            {canManage && (
              <>
                <div className="border-2 border-dashed border-border/80 rounded-2xl p-6 bg-muted/10 text-center relative group hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors`}>
                      {uploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>
                    <p className="text-sm font-semibold">
                      {uploading ? "Uploading to R2…" : "Drag and drop or click to upload"}
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, DOCX, PPTX, image, or text up to 20MB</p>
                  </div>
                </div>

                {/* Share a link (YouTube or any URL) */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="Paste a YouTube or any link…"
                    className="h-9 rounded-xl text-sm flex-1"
                  />
                  <Input
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Label (optional)"
                    className="h-9 rounded-xl text-sm sm:w-44"
                  />
                  <Button onClick={handleAddLink} disabled={pending || !linkUrl.trim()} className="h-9 rounded-xl gap-1.5 shrink-0">
                    <Plus className="w-4 h-4" /> Share link
                  </Button>
                </div>
              </>
            )}

            {/* Materials List */}
            <div className="space-y-2">
              {materials.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No materials yet. Upload a file or share a link above.
                </div>
              ) : (
                materials.map((m) => {
                  const href = m.assets[0]?.publicUrl ?? null;
                  const isLink = m.materialType === "link" || m.materialType === "video";
                  return (
                    <div key={m.id} className="p-3 border rounded-xl flex items-center justify-between bg-card hover:border-primary/20 transition-all group">
                      <a
                        href={href ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 min-w-0 flex-1 ${href ? "" : "pointer-events-none opacity-70"}`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          {isLink ? <LinkIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{m.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.materialType.toUpperCase()} · {new Date(m.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </a>

                      <div className="flex items-center gap-2 shrink-0">
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-primary">
                              {isLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                            </Button>
                          </a>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            onClick={() => void handleDeleteMaterial(m.id)}
                            className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="animate-fade-in">
            <p className="text-xs text-muted-foreground mb-3">
              Chat with this batch — share quick notes and links. Students see and reply from
              their Connect → My Institutes view.
            </p>
            <BatchChat
              messagesUrl={`/api/teacher/workspaces/${workspaceId}/batches/${batch.id}/messages`}
              mineRole="teacher"
            />
          </div>
        )}
      </div>

    </div>
  );
}
