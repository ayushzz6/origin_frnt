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
  Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiJson } from "@/lib/teacher-client";
import type { Batch, StudyMaterialWithAssets, AssessmentTest } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  batch: Batch;
  materials: StudyMaterialWithAssets[];
  tests: AssessmentTest[];
  canManage: boolean;
};

type ActiveTab = "syllabus" | "tests" | "materials";

export function BatchPlannerHighFidelity({ workspaceId, batch, materials: initialMaterials, tests, canManage }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("syllabus");
  const [materials, setMaterials] = useState(initialMaterials);
  const [uploading, setUploading] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(["ch-1"]));
  const [pending, startTransition] = useTransition();

  // Simulated Syllabus Data based on Batch Subject
  const syllabusData = {
    subject: batch.subject || "General Physics",
    chapters: [
      {
        id: "ch-1",
        title: "Newton's Laws of Motion",
        concepts: [
          { name: "Inertia and Force Definition", status: "mastered", accuracy: 84 },
          { name: "Free Body Diagrams (FBD)", status: "in_progress", accuracy: 68 },
          { name: "Friction & Banking of Roads", status: "unstarted", accuracy: 0 }
        ]
      },
      {
        id: "ch-2",
        title: "Work, Power, and Energy",
        concepts: [
          { name: "Work-Energy Theorem", status: "in_progress", accuracy: 56 },
          { name: "Conservative & Non-Conservative Forces", status: "unstarted", accuracy: 0 },
          { name: "Elastic & Inelastic Collisions", status: "unstarted", accuracy: 0 }
        ]
      },
      {
        id: "ch-3",
        title: "Rotational Mechanics",
        concepts: [
          { name: "Moment of Inertia Theorems", status: "unstarted", accuracy: 0 },
          { name: "Torque & Angular Acceleration", status: "unstarted", accuracy: 0 },
          { name: "Conservation of Angular Momentum", status: "unstarted", accuracy: 0 }
        ]
      }
    ]
  };

  // Calculate Syllabus Progression
  const totalConcepts = syllabusData.chapters.flatMap(c => c.concepts).length;
  const completedConcepts = syllabusData.chapters.flatMap(c => c.concepts).filter(con => con.status === "mastered" || con.status === "in_progress").length;
  const progressPercent = Math.round((completedConcepts / totalConcepts) * 100);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  // File Upload Ingestion
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    
    // Simulate R2/S3 upload flow: create material and assign it
    const result = await apiJson<any>(
      `/api/teacher/workspaces/${workspaceId}/study-materials`,
      {
        method: "POST",
        json: {
          title: file.name,
          description: `Uploaded study material for batch: ${batch.name}`,
          materialType: file.type.includes("pdf") ? "pdf" : "other",
          subject: batch.subject || "General",
          topic: "Class Notes",
        }
      }
    );

    if (result.ok) {
      const materialId = result.data.material.id;
      // Assign to Batch
      await apiJson(
        `/api/teacher/workspaces/${workspaceId}/study-materials/${materialId}`,
        {
          method: "POST",
          json: { targetType: "batch", targetId: batch.id }
        }
      );

      toast.success("Study material uploaded & bound successfully!");
      
      // Reload lists
      const refreshed = await apiJson<any>(
        `/api/teacher/workspaces/${workspaceId}/study-materials`,
        { method: "GET" }
      );
      if (refreshed.ok) setMaterials(refreshed.data.materials);
      router.refresh();
    } else {
      toast.error(result.detail || "Failed to upload study material");
    }
    setUploading(false);
  }

  const [error, setError] = useState<string | null>(null);

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
            This batch is currently covering the subject: <span className="font-bold text-foreground">{syllabusData.subject}</span>.
            Newton's Laws of Motion is active, while Rotational Mechanics remains unstarted.
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start text-xs font-semibold">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {syllabusData.chapters.flatMap(c => c.concepts).filter(con => con.status === "mastered").length} Mastered
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              {syllabusData.chapters.flatMap(c => c.concepts).filter(con => con.status === "in_progress").length} In Progress
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
              {syllabusData.chapters.flatMap(c => c.concepts).filter(con => con.status === "unstarted").length} Unstarted
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
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "syllabus" && (
          <div className="space-y-4 animate-fade-in">
            {syllabusData.chapters.map((chapter) => {
              const isOpen = expandedChapters.has(chapter.id);
              return (
                <div key={chapter.id} className="border rounded-2xl overflow-hidden bg-card transition-all">
                  <div 
                    onClick={() => toggleChapter(chapter.id)}
                    className="flex justify-between items-center p-4 cursor-pointer hover:bg-muted/10 transition-colors"
                  >
                    <span className="font-semibold text-sm">{chapter.title}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="border-t p-4 divide-y space-y-3 bg-muted/5">
                      {chapter.concepts.map((concept, index) => (
                        <div key={index} className="flex items-center justify-between py-2 text-sm">
                          <span className="font-medium">{concept.name}</span>
                          <div className="flex items-center gap-3">
                            {concept.accuracy > 0 && (
                              <span className="text-xs text-muted-foreground font-mono">{concept.accuracy}% accuracy</span>
                            )}
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              concept.status === "mastered" 
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                                : concept.status === "in_progress"
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : "bg-muted text-muted-foreground border"
                            }`}>
                              {concept.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
                    {uploading ? "Uploading file..." : "Drag and drop or click to upload PDF worksheets"}
                  </p>
                  <p className="text-xs text-muted-foreground">PDF, image, or docx files up to 20MB</p>
                </div>
              </div>
            )}

            {/* Materials List */}
            <div className="space-y-2">
              {materials.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No materials attached. Upload worksheets above.
                </div>
              ) : (
                materials.map((m) => (
                  <div key={m.id} className="p-3 border rounded-xl flex items-center justify-between bg-card hover:border-primary/20 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.materialType.toUpperCase()} · Published {new Date(m.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-primary">
                        <Download className="w-4 h-4" />
                      </Button>
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
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
