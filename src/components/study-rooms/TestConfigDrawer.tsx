'use client';

import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';

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

  const labelClass = cn(
    'text-[10px] font-black uppercase tracking-[0.18em]',
    isDark ? 'text-slate-500' : 'text-muted-foreground',
  );
  const fieldClass = isDark
    ? 'bg-[#111520] border-[#1a2333] text-white focus-visible:border-[#2bb1ff]/60 focus-visible:ring-[#2bb1ff]/20'
    : undefined;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            isDark && 'bg-[#111520] border-[#1a2333] text-slate-300 hover:bg-[#161b28] hover:text-white hover:border-[#2bb1ff]/40',
          )}
        >
          <Settings2 className="h-4 w-4" />
          Configure Test
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className={cn(
          isDark && 'bg-[#0a0d14] border-t-2 border-[#1a2333] shadow-[0_-8px_40px_rgba(43,177,255,0.12)]',
        )}
      >
        {/* Neon accent bar */}
        {isDark && (
          <div className="absolute top-0 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-[#2bb1ff] to-transparent opacity-60 pointer-events-none" />
        )}
        <div className="mx-auto w-full max-w-xl max-h-[80vh] overflow-y-auto">
          <DrawerHeader>
            <div className="flex items-center gap-3">
              <span className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border flex-shrink-0',
                isDark ? 'bg-[#2bb1ff]/10 border-[#2bb1ff]/30' : 'bg-primary/10 border-transparent',
              )}>
                <Settings2 className={cn('h-4 w-4', isDark ? 'text-[#2bb1ff]' : 'text-primary')} />
              </span>
              <div>
                <DrawerTitle className={cn(
                  'text-lg font-black tracking-wide uppercase',
                  isDark ? 'text-white drop-shadow-[0_0_14px_rgba(43,177,255,0.4)]' : 'text-foreground',
                )}>
                  Configure Room Test
                </DrawerTitle>
                <DrawerDescription className={cn(isDark ? 'text-slate-500' : 'text-muted-foreground')}>
                  Generate one custom test for every active participant.
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label className={labelClass}>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
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
              <Label className={labelClass}>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="room-test-chapter" className={labelClass}>Chapter</Label>
              <Input id="room-test-chapter" className={fieldClass} value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="Optional chapter focus" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="room-test-count" className={labelClass}>Question Count</Label>
              <Input
                id="room-test-count"
                type="number"
                min={1}
                max={60}
                className={fieldClass}
                value={questionCount}
                onChange={(event) => setQuestionCount(Math.min(60, Math.max(1, Number(event.target.value))))}
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={submit}
              disabled={isSubmitting}
              className={cn(
                'font-black uppercase tracking-wider',
                isDark && 'bg-gradient-to-r from-[#2bb1ff] to-[#006495] text-white border border-white/15 shadow-[0_0_22px_rgba(43,177,255,0.32)] hover:from-[#3bbbff] hover:to-[#0078b3] hover:shadow-[0_0_34px_rgba(43,177,255,0.5)]',
              )}
            >
              {isSubmitting ? 'Generating...' : 'Generate Test'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
