"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/teacher-client";
import type { QuestionWithVersion, BatchWithCounts, AssessmentTest } from "@/server/workspaces/types";
import { toast } from "sonner";

import { QuestionPicker, type SelectedQuestion } from "./QuestionPicker";

type Props = {
  workspaceId: string;
  questions: QuestionWithVersion[];
  batches: BatchWithCounts[];
  ogcodeEnabled: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

const STEPS = ["Details", "Select Questions", "Target & Schedule"];

export function TestCreatorWizard({ workspaceId, questions, batches, ogcodeEnabled, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [pending, startTransition] = useTransition();

  // Step 1: Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [duration, setDuration] = useState(60);
  const [marksPositive, setMarksPositive] = useState(4);
  const [marksNegative, setMarksNegative] = useState(1);

  // Step 2: Selected Questions (mixed-source: OG Code + Question Bag)
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);

  // Step 3: Target & Schedule
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [hideLeaderboard, setHideLeaderboard] = useState(false);

  const nextStep = () => {
    if (currentStep === 0) {
      if (!title.trim() || !subject.trim()) {
        toast.error("Test Title and Subject are required.");
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (selectedQuestions.length === 0) {
        toast.error("Please select at least one question for the test.");
        return;
      }
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  async function submit() {
    if (!selectedBatchId) {
      toast.error("Please select a target batch.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please specify a scheduled window.");
      return;
    }

    startTransition(async () => {
      // 1. Create Test — per-question source + marks (mixed OG Code + Question Bag).
      const questionsPayload = selectedQuestions.map((q, idx) => ({
        position: idx + 1,
        sourceBank: q.sourceBank,
        ogcodeQuestionId: q.sourceBank === "ogcode" ? q.id : null,
        contentQuestionId: q.sourceBank === "workspace_bag" ? q.id : null,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      }));

      const testResult = await apiJson<{ test: AssessmentTest }>(
        `/api/teacher/workspaces/${workspaceId}/tests`,
        {
          method: "POST",
          json: {
            title: title.trim(),
            description: description.trim() || null,
            subject: subject.trim(),
            difficulty,
            durationMinutes: Number(duration),
            scoringPolicy: { positive: marksPositive, negative: marksNegative },
            settings: { shuffle, autoSubmit, hideLeaderboard },
            questions: questionsPayload
          }
        }
      );

      if (!testResult.ok) {
        toast.error(testResult.detail || "Failed to create test");
        return;
      }

      const testId = testResult.data.test.id;

      // 2. Publish (draft → published) so enrolled students can see it.
      const publishResult = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/tests/${testId}/schedule?action=publish`,
        { method: "POST" }
      );
      if (!publishResult.ok) {
        toast.error(publishResult.detail || "Failed to publish test");
        return;
      }

      // 3. Assign to the batch with the scheduled window (batchIds is an array).
      const assignResult = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/tests/${testId}/assign`,
        {
          method: "POST",
          json: {
            batchIds: [selectedBatchId],
            scheduledStartAt: new Date(startDate).toISOString(),
            scheduledEndAt: new Date(endDate).toISOString(),
          }
        }
      );

      if (!assignResult.ok) {
        toast.error(assignResult.detail || "Failed to assign test to batch");
        return;
      }

      toast.success("Test published and assigned — your students can see it now.");
      onSuccess();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* WizardProgressHeader */}
      <div className="flex items-center justify-between border-b pb-4 shrink-0">
        <h3 className="font-bold text-lg">Create Scheduled Test</h3>
        <div className="flex gap-2 text-xs font-semibold text-muted-foreground">
          {STEPS.map((s, idx) => {
            const isActive = currentStep === idx;
            const isDone = currentStep > idx;
            return (
              <span key={s} className={`flex items-center gap-1.5 ${
                isActive ? "text-primary font-bold" : isDone ? "text-emerald-500" : ""
              }`}>
                {isDone ? <Check className="w-3.5 h-3.5" /> : <span>{idx + 1}</span>}
                {s}
                {idx < STEPS.length - 1 && <span className="text-muted-foreground/30">/</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Wizard step contents */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 0 && (
            /* Step 1: Details form */
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-base">Test Settings & Policies</CardTitle>
                <CardDescription>Specify name, duration, and grading configurations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="t-title">Test Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} id="t-title" placeholder="JEE Practice Mock - Electrostatics" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-desc">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} id="t-desc" placeholder="Review formulas and Coulomb's law topics..." rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-sub">Subject *</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} id="t-sub" placeholder="Physics" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-diff">Difficulty</Label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="insane">Insane</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-dur">Duration (Minutes)</Label>
                    <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} id="t-dur" min={5} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-pos">Correct Marks (+)</Label>
                    <Input type="number" value={marksPositive} onChange={(e) => setMarksPositive(Number(e.target.value))} id="t-pos" min={1} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-neg">Negative Marks (-)</Label>
                    <Input type="number" value={marksNegative} onChange={(e) => setMarksNegative(Number(e.target.value))} id="t-neg" min={0} />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
                  <Button onClick={nextStep} className="bg-primary hover:bg-primary/95 text-black font-bold gap-1 rounded-xl">
                    Select Questions <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            /* Step 2: mixed-source question picker (OG Code + Question Bag) */
            <div className="space-y-4">
              <QuestionPicker
                value={selectedQuestions}
                onChange={setSelectedQuestions}
                workspaceId={workspaceId}
                bagQuestions={questions}
                ogcodeEnabled={ogcodeEnabled}
                defaultMarks={marksPositive}
                defaultNegativeMarks={marksNegative}
              />
              <div className="flex justify-between border-t pt-4">
                <Button variant="outline" onClick={prevStep} className="rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={nextStep} disabled={selectedQuestions.length === 0} className="bg-primary hover:bg-primary/95 text-black font-bold gap-1 rounded-xl">
                  Schedule Window <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            /* Step 3: Target & Schedule */
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-base">Target Schedule & Settings</CardTitle>
                <CardDescription>Assign the compiled test to student batches and set deadlines.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="t-batch">Target Classroom Batch *</Label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    required
                    className="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select a batch...</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.studentCount} students)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-start">Scheduled Start Date/Time *</Label>
                    <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} id="t-start" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-end">Scheduled End Date/Time *</Label>
                    <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} id="t-end" required />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Proctoring & Delivery Toggles</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium">
                    <label className="flex items-center gap-2.5 border rounded-xl p-3 cursor-pointer hover:bg-muted/10">
                      <Checkbox checked={shuffle} onCheckedChange={(c) => setShuffle(!!c)} />
                      <div className="flex flex-col">
                        <span>Shuffle Questions</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Prevent student copying</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2.5 border rounded-xl p-3 cursor-pointer hover:bg-muted/10">
                      <Checkbox checked={autoSubmit} onCheckedChange={(c) => setAutoSubmit(!!c)} />
                      <div className="flex flex-col">
                        <span>Auto-Submit</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Enforce strict timer limit</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2.5 border rounded-xl p-3 cursor-pointer hover:bg-muted/10">
                      <Checkbox checked={hideLeaderboard} onCheckedChange={(c) => setHideLeaderboard(!!c)} />
                      <div className="flex flex-col">
                        <span>Suppress Leaderboard</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Hide active rankings</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={prevStep} disabled={pending} className="rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>
                  <Button 
                    onClick={() => startTransition(() => submit())} 
                    disabled={pending}
                    className="bg-primary hover:bg-primary/95 text-black font-bold rounded-xl gap-1.5"
                  >
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Confirm & Publish Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
