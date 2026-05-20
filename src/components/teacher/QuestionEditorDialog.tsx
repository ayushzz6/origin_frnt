"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/teacher-client";
import type { QuestionWithVersion } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  initialQuestion?: QuestionWithVersion | null;
  onSuccess?: (question: QuestionWithVersion) => void;
};

const QUESTION_TYPES = [
  { value: "mcq", label: "MCQ (Single Correct)" },
  { value: "msq", label: "MSQ (Multi-Select)" },
  { value: "numerical", label: "Numerical" },
  { value: "numerical_with_units", label: "Numerical with Units" },
  { value: "symbolic_expression", label: "Symbolic Expression" },
  { value: "equation", label: "Equation" },
  { value: "matrix_match", label: "Matrix Match" },
  { value: "subjective", label: "Subjective" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "insane", label: "Insane" },
];

export function QuestionEditorDialog({ workspaceId, initialQuestion, onSuccess }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [questionType, setQuestionType] = useState<string>(initialQuestion?.currentVersion?.questionType ?? "mcq");
  const [stem, setStem] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [concept, setConcept] = useState("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [options, setOptions] = useState<Array<{ id: string; text: string; isCorrect: boolean }>>([
    { id: "a", text: "", isCorrect: true },
    { id: "b", text: "", isCorrect: false },
    { id: "c", text: "", isCorrect: false },
    { id: "d", text: "", isCorrect: false },
  ]);
  const [correctOption, setCorrectOption] = useState<number>(0);
  const [correctOptions, setCorrectOptions] = useState<number[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [hint, setHint] = useState("");
  const [explanation, setExplanation] = useState("");
  const [fullSolution, setFullSolution] = useState("");
  const [tags, setTags] = useState("");

  function reset() {
    setStem("");
    setSubject("");
    setChapter("");
    setConcept("");
    setDifficulty("medium");
    setQuestionType("mcq");
    setOptions([
      { id: "a", text: "", isCorrect: true },
      { id: "b", text: "", isCorrect: false },
      { id: "c", text: "", isCorrect: false },
      { id: "d", text: "", isCorrect: false },
    ]);
    setCorrectOption(0);
    setCorrectOptions([]);
    setAnswerText("");
    setHint("");
    setExplanation("");
    setFullSolution("");
    setTags("");
    setError(null);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    setOpen(o);
  }

  function toggleCorrectOption(index: number) {
    if (questionType === "msq") {
      setCorrectOptions((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
      );
    } else {
      setCorrectOption(index);
    }
  }

  async function submit() {
    setError(null);
    const parsedOptions = questionType === "mcq" || questionType === "msq"
      ? options.map((o, i) => ({ id: o.id, text: o.text, isCorrect: questionType === "msq" ? correctOptions.includes(i) : i === correctOption }))
      : null;

    const result = await apiJson<{ question: QuestionWithVersion }>(
      `/api/teacher/workspaces/${workspaceId}/questions`,
      {
        method: "POST",
        json: {
          questionType,
          stem,
          options: parsedOptions,
          correctOption: questionType === "mcq" ? correctOption : null,
          correctOptions: questionType === "msq" ? correctOptions : null,
          answerText: answerText || null,
          subject,
          chapter,
          concept,
          difficulty,
          hint: hint || null,
          explanation: explanation || null,
          fullSolution: fullSolution || null,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        },
      },
    );

    if (!result.ok) {
      setError(result.detail);
      return;
    }

    setOpen(false);
    reset();
    onSuccess?.(result.data.question);
    router.refresh();
  }

  const showOptions = questionType === "mcq" || questionType === "msq";
  const showCorrectOption = questionType === "mcq";
  const showCorrectOptions = questionType === "msq";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add question</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add question</DialogTitle>
          <DialogDescription>
            Fill in the question details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => void submit());
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="q-type">Question type *</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger id="q-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-difficulty">Difficulty *</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="q-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-stem">Question stem *</Label>
            <Textarea
              id="q-stem"
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              rows={3}
              required
              placeholder="Enter the question..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="q-subject">Subject *</Label>
              <Input
                id="q-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Physics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-chapter">Chapter *</Label>
              <Input
                id="q-chapter"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                required
                placeholder="Mechanics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-concept">Concept *</Label>
              <Input
                id="q-concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                required
                placeholder="Kinematics"
              />
            </div>
          </div>

          {showOptions && (
            <div className="space-y-2">
              <Label>Options {showCorrectOption ? "(mark the correct one)" : "(mark correct ones)"}</Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        questionType === "msq"
                          ? correctOptions.includes(i) ? "default" : "outline"
                          : i === correctOption ? "default" : "outline"
                      }
                      onClick={() => toggleCorrectOption(i)}
                    >
                      {String.fromCharCode(65 + i)}
                    </Button>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], text: e.target.value };
                        setOptions(next);
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showOptions && (
            <div className="space-y-2">
              <Label htmlFor="q-answer">Answer</Label>
              <Textarea
                id="q-answer"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={2}
                placeholder="Expected answer or value..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="q-hint">Hint (recommended)</Label>
            <Input
              id="q-hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="A helpful nudge for students..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-explanation">Explanation</Label>
            <Textarea
              id="q-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="Brief explanation of the answer..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-solution">Full solution (recommended for OGCode)</Label>
            <Textarea
              id="q-solution"
              value={fullSolution}
              onChange={(e) => setFullSolution(e.target.value)}
              rows={3}
              placeholder="Step-by-step solution..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-tags">Tags (comma-separated)</Label>
            <Input
              id="q-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="jee-main, neet, class-11"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !stem.trim() || !subject.trim() || !chapter.trim() || !concept.trim()}>
              {pending ? "Creating…" : "Create question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}