"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Check, 
  Globe, 
  Lock, 
  Edit, 
  Eye,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Loader2,
  CheckCircle,
  FileCheck
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FormattedMessage } from "@/components/origin-ai/FormattedMessage";
import { apiJson } from "@/lib/teacher-client";
import type { QuestionWithVersion, QuestionType, QuestionStatus } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  initialQuestions: QuestionWithVersion[];
  canEdit: boolean;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  insane: "Insane",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800/30",
  medium: "text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800/30",
  hard: "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800/30",
  insane: "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/30",
};

export function QuestionBagManagerHighFidelity({ workspaceId, initialQuestions, canEdit }: Props) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionWithVersion[]>(initialQuestions);
  const [activeQuestion, setActiveQuestion] = useState<QuestionWithVersion | null>(
    initialQuestions.length > 0 ? initialQuestions[0] : null
  );

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterType, setFilterType] = useState("all");
  
  // Editor State
  const [editMode, setEditMode] = useState(false);
  const [editType, setEditType] = useState<QuestionType>("mcq");
  const [editStem, setEditStem] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editConcept, setEditConcept] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<"easy" | "medium" | "hard" | "insane">("medium");
  const [editOptions, setEditOptions] = useState<Array<{ id: string; text: string }>>([
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ]);
  const [editCorrectOption, setEditCorrectOption] = useState<number | null>(0);
  const [editCorrectOptions, setEditCorrectOptions] = useState<number[]>([]);
  const [editAnswerText, setEditAnswerText] = useState("");
  const [editHint, setEditHint] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editFullSolution, setEditFullSolution] = useState("");

  // Transition & Loader states
  const [pending, startTransition] = useTransition();

  // Distinct subjects list from questions
  const subjectsList = Array.from(new Set(questions.map(q => q.currentVersion?.subject).filter(Boolean)));

  // Filter implementation
  const filteredQuestions = questions.filter(q => {
    const v = q.currentVersion;
    if (!v) return false;

    // Search query match
    if (searchQuery.trim()) {
      const stemMatch = v.stem.toLowerCase().includes(searchQuery.toLowerCase());
      const chapterMatch = v.chapter.toLowerCase().includes(searchQuery.toLowerCase());
      const conceptMatch = v.concept.toLowerCase().includes(searchQuery.toLowerCase());
      if (!stemMatch && !chapterMatch && !conceptMatch) return false;
    }

    // Dropdown filters
    if (filterSubject !== "all" && v.subject !== filterSubject) return false;
    if (filterDifficulty !== "all" && v.difficulty !== filterDifficulty) return false;
    if (filterType !== "all" && v.questionType !== filterType) return false;

    return true;
  });

  // Group like the OG Code catalog: subject › chapter (topic), each group's
  // questions ordered easy → insane so the bag reads difficulty-level-wise.
  const DIFFICULTY_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2, insane: 3 };
  const groupedQuestions = (() => {
    const groups = new Map<string, { subject: string; chapter: string; items: QuestionWithVersion[] }>();
    for (const q of filteredQuestions) {
      const v = q.currentVersion;
      if (!v) continue;
      const key = `${v.subject}|||${v.chapter}`;
      if (!groups.has(key)) groups.set(key, { subject: v.subject, chapter: v.chapter, items: [] });
      groups.get(key)!.items.push(q);
    }
    const list = Array.from(groups.values());
    list.sort((a, b) => a.subject.localeCompare(b.subject) || a.chapter.localeCompare(b.chapter));
    for (const g of list) {
      g.items.sort(
        (a, b) =>
          (DIFFICULTY_RANK[a.currentVersion?.difficulty ?? "medium"] ?? 1) -
          (DIFFICULTY_RANK[b.currentVersion?.difficulty ?? "medium"] ?? 1),
      );
    }
    return list;
  })();

  const selectQuestion = (q: QuestionWithVersion) => {
    setActiveQuestion(q);
    setEditMode(false);
  };

  const enterEditMode = () => {
    if (!activeQuestion || !activeQuestion.currentVersion) return;
    const v = activeQuestion.currentVersion;
    setEditType(v.questionType);
    setEditStem(v.stem);
    setEditSubject(v.subject);
    setEditChapter(v.chapter);
    setEditConcept(v.concept);
    setEditDifficulty(v.difficulty);
    setEditOptions(v.options?.map(o => ({ id: o.id, text: o.text })) || [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ]);
    setEditCorrectOption(v.correctOption);
    setEditCorrectOptions(v.correctOptions || []);
    setEditAnswerText(v.answerText || "");
    setEditHint(v.hint || "");
    setEditExplanation(v.explanation || "");
    setEditFullSolution(v.fullSolution || "");
    setEditMode(true);
  };

  const enterCreateMode = () => {
    setActiveQuestion(null);
    setEditType("mcq");
    setEditStem("");
    setEditSubject("");
    setEditChapter("");
    setEditConcept("");
    setEditDifficulty("medium");
    setEditOptions([
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ]);
    setEditCorrectOption(0);
    setEditCorrectOptions([]);
    setEditAnswerText("");
    setEditHint("");
    setEditExplanation("");
    setEditFullSolution("");
    setEditMode(true);
  };

  const toggleMsqOption = (index: number) => {
    setEditCorrectOptions(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // API Mutating Actions
  async function handlePublishPrivate(questionId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/questions/${questionId}/publish-private`,
        { method: "POST", json: {} }
      );
      if (result.ok) {
        toast.success("Question published to private workspace bag!");
        // Update local status
        setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, status: "published_private" as const } : q));
        if (activeQuestion?.id === questionId) {
          setActiveQuestion(prev => prev ? { ...prev, status: "published_private" as const } : null);
        }
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to publish question");
      }
    });
  }

  async function handleSubmitToOgCode(questionId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/questions/${questionId}/submit-ogcode`,
        { 
          method: "POST", 
          json: { attributionName: "ORIGIN Academy" } // Default Academy attribution uploader preview
        }
      );
      if (result.ok) {
        toast.success("Question submitted to public OGCode moderation pool!");
        setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, status: "submitted_to_ogcode" as const } : q));
        if (activeQuestion?.id === questionId) {
          setActiveQuestion(prev => prev ? { ...prev, status: "submitted_to_ogcode" as const } : null);
        }
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to submit to OGCode");
      }
    });
  }

  async function handleArchive(questionId: string) {
    if (!confirm("Are you sure you want to delete this question?")) return;
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/questions/${questionId}`,
        { method: "DELETE" }
      );
      if (result.ok) {
        toast.success("Question archived/deleted successfully");
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        setActiveQuestion(prev => prev?.id === questionId ? null : prev);
        setEditMode(false);
        router.refresh();
      } else {
        toast.error("Failed to archive question");
      }
    });
  }

  async function saveQuestion() {
    if (!editStem.trim() || !editSubject.trim() || !editChapter.trim() || !editConcept.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const isEdit = !!activeQuestion;
      const url = isEdit
        ? `/api/teacher/workspaces/${workspaceId}/questions/${activeQuestion.id}`
        : `/api/teacher/workspaces/${workspaceId}/questions`;
      
      const method = isEdit ? "PATCH" : "POST";
      const payload = {
        questionType: editType,
        stem: editStem,
        subject: editSubject,
        chapter: editChapter,
        concept: editConcept,
        difficulty: editDifficulty,
        hint: editHint || null,
        explanation: editExplanation || null,
        fullSolution: editFullSolution || null,
        options: editType === "mcq" || editType === "msq" ? editOptions : null,
        correctOption: editType === "mcq" ? editCorrectOption : null,
        correctOptions: editType === "msq" ? editCorrectOptions : null,
        answerText: editType !== "mcq" && editType !== "msq" ? editAnswerText : null,
      };

      const result = await apiJson<any>(url, { method, json: payload });

      if (result.ok) {
        toast.success(isEdit ? "Question changes saved!" : "New question added!");
        
        // Fetch refreshed question directory
        const refreshed = await apiJson<any>(
          `/api/teacher/workspaces/${workspaceId}/questions`,
          { method: "GET" }
        );
        if (refreshed.ok) {
          const list = refreshed.data.questions || [];
          setQuestions(list);
          if (isEdit) {
            const updated = list.find((q: any) => q.id === activeQuestion.id);
            if (updated) setActiveQuestion(updated);
          } else if (list.length > 0) {
            setActiveQuestion(list[0]);
          }
        }
        setEditMode(false);
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to save question");
      }
    });
  }

  const showOptions = editType === "mcq" || editType === "msq";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-6xl mx-auto h-[78vh]">
      
      {/* Left Pane: Filters & Listing */}
      <div className="lg:col-span-2 flex flex-col border rounded-2xl bg-card overflow-hidden h-full">
        
        {/* Search and Filters */}
        <div className="p-4 border-b space-y-3 shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm">Question Library</h3>
            {canEdit && (
              <Button onClick={enterCreateMode} size="sm" className="h-8 bg-primary hover:bg-primary/95 text-black font-bold rounded-lg gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stem or chapter..."
              className="pl-9 h-9 rounded-xl text-xs border-border/80"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* Subject */}
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-[10px] font-semibold focus:outline-none"
            >
              <option value="all">All Subjects</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {/* Difficulty */}
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-[10px] font-semibold focus:outline-none"
            >
              <option value="all">Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="insane">Insane</option>
            </select>
            {/* Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-[10px] font-semibold focus:outline-none"
            >
              <option value="all">Types</option>
              <option value="mcq">MCQ</option>
              <option value="msq">MSQ</option>
              <option value="numerical">Numerical</option>
              <option value="subjective">Subjective</option>
            </select>
          </div>
        </div>

        {/* LibraryQuestionCardList — grouped subject › chapter, difficulty-ordered */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/5">
          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No questions found. Add one or modify filters.
            </div>
          ) : (
            groupedQuestions.map(group => (
              <div key={`${group.subject}|||${group.chapter}`}>
                <div className="sticky top-0 z-10 px-4 py-2 bg-muted/80 backdrop-blur border-b flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide truncate">
                    <span className="text-primary">{group.subject}</span>
                    <span className="text-muted-foreground"> › {group.chapter}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{group.items.length}</span>
                </div>
                <div className="divide-y">
                  {group.items.map(q => {
                    const isActive = activeQuestion?.id === q.id;
                    const v = q.currentVersion;
                    return (
                      <div
                        key={q.id}
                        onClick={() => selectQuestion(q)}
                        className={`p-4 cursor-pointer transition-all flex flex-col gap-2 relative ${
                          isActive ? "bg-primary/[0.03] border-l-4 border-l-primary" : "hover:bg-muted/10 border-l-4 border-l-transparent"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-muted border font-mono">
                            {v?.questionType}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            q.status === "published_ogcode" ? "text-emerald-500" : "text-muted-foreground"
                          }`}>
                            {q.status.replace(/_/g, " ")}
                          </span>
                        </div>

                        <p className="text-xs line-clamp-2 select-none pr-2 font-medium">
                          {v?.stem || "(no stem)"}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[9px] px-2 py-0.5 rounded-full border bg-background font-semibold">{v?.concept}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${DIFFICULTY_COLORS[v?.difficulty || "medium"]}`}>
                            {DIFFICULTY_LABELS[v?.difficulty || "medium"]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Authoring Editor / Question Viewer */}
      <div className="lg:col-span-3 border rounded-2xl bg-card overflow-hidden h-full flex flex-col relative">
        <AnimatePresence mode="wait">
          {editMode ? (
            /* LaTeXStemEditor Authoring view */
            <motion.div 
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              <div className="p-4 border-b flex justify-between items-center shrink-0">
                <h3 className="font-bold text-sm">{activeQuestion ? "Edit Question" : "Author New Question"}</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditMode(false)} disabled={pending} className="h-8 rounded-lg">
                    Cancel
                  </Button>
                  <Button onClick={saveQuestion} size="sm" disabled={pending} className="h-8 bg-primary hover:bg-primary/95 text-black font-bold rounded-lg gap-1.5">
                    {pending ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                    Save Changes
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar pb-10">
                {/* Form row 1 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Question Type</Label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as QuestionType)}
                      className="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="mcq">MCQ (Single Correct)</option>
                      <option value="msq">MSQ (Multi-Select)</option>
                      <option value="numerical">Numerical</option>
                      <option value="subjective">Subjective</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Difficulty</Label>
                    <select
                      value={editDifficulty}
                      onChange={(e) => setEditDifficulty(e.target.value as any)}
                      className="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="insane">Insane</option>
                    </select>
                  </div>
                </div>

                {/* Form row 2 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Subject *</Label>
                    <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Physics" className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Chapter *</Label>
                    <Input value={editChapter} onChange={(e) => setEditChapter(e.target.value)} placeholder="Electrostatics" className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Concept *</Label>
                    <Input value={editConcept} onChange={(e) => setEditConcept(e.target.value)} placeholder="Gauss Law" className="h-10 rounded-xl" />
                  </div>
                </div>

                {/* LaTeXStemEditor with Live Preview */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Question Stem (LaTeX supported) *</Label>
                  <Textarea 
                    value={editStem} 
                    onChange={(e) => setEditStem(e.target.value)}
                    rows={4}
                    placeholder="Enter question text... Use $ for inline math (e.g. $x^2$) and $$ for block equations."
                    className="rounded-xl border-border/80 focus-visible:ring-primary font-mono text-sm"
                  />
                  {editStem.trim() && (
                    <div className="border rounded-xl p-4 bg-muted/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">Live Equation Preview</p>
                      <FormattedMessage content={editStem} className="text-sm select-text" />
                    </div>
                  )}
                </div>

                {/* Dynamic Options Grid */}
                {showOptions && (
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold">
                      Options {editType === "mcq" ? "(Mark single correct option)" : "(Mark correct options)"}
                    </Label>
                    <div className="space-y-2">
                      {editOptions.map((opt, i) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              editType === "msq"
                                ? editCorrectOptions.includes(i) ? "default" : "outline"
                                : i === editCorrectOption ? "default" : "outline"
                            }
                            onClick={() => {
                              if (editType === "msq") {
                                toggleMsqOption(i);
                              } else {
                                setEditCorrectOption(i);
                              }
                            }}
                            className="w-10 h-10 rounded-xl shrink-0 font-bold"
                          >
                            {String.fromCharCode(65 + i)}
                          </Button>
                          <Input
                            value={opt.text}
                            onChange={(e) => {
                              const next = [...editOptions];
                              next[i] = { ...next[i], text: e.target.value };
                              setEditOptions(next);
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                            className="h-10 rounded-xl border-border/80"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Numerical / Subjective Answer Input */}
                {!showOptions && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Correct Answer Value</Label>
                    <Input 
                      value={editAnswerText} 
                      onChange={(e) => setEditAnswerText(e.target.value)}
                      placeholder="e.g. 5.6 or equation expression"
                      className="h-10 rounded-xl"
                    />
                  </div>
                )}

                {/* Hints and solutions */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Hint</Label>
                    <Input value={editHint} onChange={(e) => setEditHint(e.target.value)} placeholder="Brief hint for students..." className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Explanation</Label>
                    <Textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} placeholder="Explain the key reasoning..." rows={2} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Solved Solution (Required for OGCode)</Label>
                    <Textarea value={editFullSolution} onChange={(e) => setEditFullSolution(e.target.value)} placeholder="Write step-by-step mathematical proof..." rows={4} className="rounded-xl font-mono text-sm" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeQuestion ? (
            /* Question Viewer pane */
            <motion.div 
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Header actions */}
              <div className="p-4 border-b flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[activeQuestion.currentVersion?.difficulty || "medium"]}`}>
                    {DIFFICULTY_LABELS[activeQuestion.currentVersion?.difficulty || "medium"]}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold uppercase">{activeQuestion.status.replace(/_/g, " ")}</span>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={enterEditMode} className="h-8 rounded-lg gap-1">
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </Button>
                  )}
                  {canEdit && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleArchive(activeQuestion.id)}
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Stem and Details */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-10">
                {/* Stem Render with LaTeX */}
                <div className="prose dark:prose-invert max-w-none bg-muted/10 p-5 rounded-2xl border">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">Question Text</p>
                  <FormattedMessage content={activeQuestion.currentVersion?.stem || ""} className="text-base select-text leading-relaxed font-medium" />
                </div>

                {/* Render Options list */}
                {activeQuestion.currentVersion?.options && activeQuestion.currentVersion.options.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">Options</p>
                    <div className="grid gap-2 grid-cols-1">
                      {activeQuestion.currentVersion.options.map((opt, i) => {
                        const isCorrectMCQ = activeQuestion.currentVersion?.correctOption === i;
                        const isCorrectMSQ = activeQuestion.currentVersion?.correctOptions?.includes(i);
                        const isCorrect = activeQuestion.currentVersion?.questionType === "msq" ? isCorrectMSQ : isCorrectMCQ;
                        return (
                          <div 
                            key={opt.id} 
                            className={`p-3 border rounded-xl flex items-center gap-3 bg-card ${
                              isCorrect ? "border-emerald-500/30 bg-emerald-500/[0.02]" : "border-border"
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isCorrect ? "bg-emerald-500 text-black" : "bg-muted text-muted-foreground"
                            }`}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className="text-sm font-medium">{opt.text}</span>
                            {isCorrect && <Check className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Render Answer Value */}
                {(!activeQuestion.currentVersion?.options || activeQuestion.currentVersion.options.length === 0) && (
                  <div className="bg-muted/10 p-4 rounded-xl border flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Expected Answer Value</span>
                    <span className="font-mono font-bold text-emerald-500">{activeQuestion.currentVersion?.answerText || "—"}</span>
                  </div>
                )}

                {/* Show Hints & Solutions */}
                {activeQuestion.currentVersion?.hint && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Hint</p>
                    <p className="text-sm italic text-muted-foreground">{activeQuestion.currentVersion.hint}</p>
                  </div>
                )}

                {activeQuestion.currentVersion?.explanation && (
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Brief Explanation</p>
                    <p className="text-sm select-text text-muted-foreground">{activeQuestion.currentVersion.explanation}</p>
                  </div>
                )}

                {activeQuestion.currentVersion?.fullSolution && (
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Full Solved Solution</p>
                    <div className="bg-muted/20 p-4 rounded-xl border font-mono text-xs overflow-x-auto select-text">
                      <FormattedMessage content={activeQuestion.currentVersion.fullSolution} />
                    </div>
                  </div>
                )}

                {/* Publish & Submission Actions Sticky Footer */}
                {canEdit && (
                  <div className="border-t pt-6 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Publishing Controls</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {activeQuestion.status === "draft" || activeQuestion.status === "needs_review" ? (
                        <Button 
                          onClick={() => handlePublishPrivate(activeQuestion.id)} 
                          disabled={pending}
                          className="flex-1 bg-primary hover:bg-primary/95 text-black font-bold h-11 rounded-xl gap-2"
                        >
                          {pending ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Lock className="w-4 h-4" />}
                          Publish to Private Workspace
                        </Button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center border rounded-xl bg-muted/20 text-xs font-semibold text-emerald-500 gap-1.5 h-11">
                          <CheckCircle className="w-4 h-4" /> Published Privately
                        </div>
                      )}
                      
                      {activeQuestion.status !== "published_ogcode" && activeQuestion.status !== "submitted_to_ogcode" ? (
                        <Button 
                          onClick={() => handleSubmitToOgCode(activeQuestion.id)} 
                          disabled={pending}
                          variant="outline"
                          className="flex-1 border-primary/20 hover:bg-primary/5 text-primary font-bold h-11 rounded-xl gap-2"
                        >
                          {pending ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Globe className="w-4 h-4" />}
                          Submit to Public OGCode Pool
                        </Button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center border rounded-xl bg-muted/20 text-xs font-semibold text-primary gap-1.5 h-11">
                          <Globe className="w-4 h-4" /> {activeQuestion.status === "submitted_to_ogcode" ? "Awaiting Moderation" : "Active in OGCode"}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Placeholder card */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
              <BookOpen className="w-12 h-12 text-muted-foreground/60" />
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-base">Select a Question</h4>
                <p className="text-xs max-w-xs">Select any question from the left directory list to view details or perform edits.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
