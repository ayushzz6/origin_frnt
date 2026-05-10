'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function TestConfigDrawer({
  disabled,
  onConfigure,
}: {
  disabled?: boolean;
  onConfigure: (payload: { subject: string; difficulty: string; chapter?: string; question_count: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('mixed');
  const [difficulty, setDifficulty] = useState('medium');
  const [chapter, setChapter] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      await onConfigure({
        subject,
        difficulty,
        chapter: chapter.trim() || undefined,
        question_count: questionCount,
      });
      toast.success('Room test configured.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not configure test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Settings2 className="h-4 w-4" />
          Configure Test
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-xl">
          <DrawerHeader>
            <DrawerTitle>Configure Room Test</DrawerTitle>
            <DrawerDescription>Generate one custom test for every active participant.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="physics">Physics</SelectItem>
                  <SelectItem value="chemistry">Chemistry</SelectItem>
                  <SelectItem value="mathematics">Mathematics</SelectItem>
                  <SelectItem value="biology">Biology</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="room-test-chapter">Chapter</Label>
              <Input id="room-test-chapter" value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="Optional chapter focus" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="room-test-count">Question Count</Label>
              <Input
                id="room-test-count"
                type="number"
                min={1}
                max={60}
                value={questionCount}
                onChange={(event) => setQuestionCount(Math.min(60, Math.max(1, Number(event.target.value))))}
              />
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? 'Generating...' : 'Generate Test'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
