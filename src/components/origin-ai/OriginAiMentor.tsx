'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, Send, Square, TriangleAlert, X, PanelLeft, PanelRight } from 'lucide-react';

import {
  getOriginAiSession,
  sendOriginAiMessage,
} from '@/features/origin-ai/client';
import { useOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { clearHighlightedText, getHighlightedText, getPendingHighlightedText, useHighlightedText } from '@/features/origin-ai/highlight-capture';
import { startOriginAiVoiceMode, type OriginAiVoiceController } from '@/features/origin-ai/voice-client';
import { cn } from '@/lib/utils';
import type { OriginAiSnapshot, OriginAiVoiceStatus } from '@/types';
import { FormattedMessage } from './FormattedMessage';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useQuota } from '@/context/QuotaContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import dynamic from 'next/dynamic';
import OriMascotStatic from '@/features/mascot/OriMascotStatic';
import { useMentorMascotState } from '@/features/mascot/useMentorMascotState';

// Live 3D mascot (WebGL) — client-only; procedural body + PNG fallback handle SSR/no-WebGL.
const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });

interface OriginAiMentorProps {
  compact?: boolean;
  onClose?: () => void;
  autoAskSelectionNonce?: number;
  isSidebar?: boolean;
  side?: 'left' | 'right';
  onSideToggle?: () => void;
}

function formatRelativeTimestamp(date: Date): string {
  const diffSeconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function PolicyBadge({ snapshot }: { snapshot: OriginAiSnapshot }) {
  const tone =
    snapshot.pagePolicy.mode === 'answer_blocked'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
      : snapshot.pagePolicy.mode === 'hint_only'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';

  return (
    <div className={cn('rounded-2xl border px-3 py-2 text-xs leading-5', tone)}>
      <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.2em]">
        <TriangleAlert className="h-3.5 w-3.5" />
        {snapshot.pagePolicy.title}
      </div>
      <p className="mt-1 opacity-90">{snapshot.pagePolicy.reason}</p>
    </div>
  );
}

function ReminderCards({ snapshot, compact = false }: { snapshot: OriginAiSnapshot; compact?: boolean }) {
  if (snapshot.reminders.length === 0) {
    return null;
  }

  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
      {snapshot.reminders.slice(0, compact ? 2 : 4).map((reminder) => (
        <div
          key={reminder.id}
          className={cn(
            'rounded-2xl border border-white/10 bg-white/[0.04] p-3',
            reminder.priority === 'high'
              ? 'shadow-[0_0_0_1px_rgba(251,191,36,0.12)]'
              : reminder.priority === 'medium'
                ? 'shadow-[0_0_0_1px_rgba(96,165,250,0.12)]'
                : 'shadow-[0_0_0_1px_rgba(52,211,153,0.10)]',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {reminder.kind}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">{reminder.title}</div>
            </div>
            <span className="rounded-full bg-muted/40 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-foreground/80">
              {reminder.priority}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{reminder.message}</p>
        </div>
      ))}
    </div>
  );
}

function MessageList({ snapshot }: { snapshot: OriginAiSnapshot }) {
  return (
    <div className="space-y-4">
      {snapshot.session.messages.map((message) => {
        const isAssistant = message.role === 'assistant';
        return (
          <div
            key={message.id}
            className={cn('flex', isAssistant ? 'justify-start' : 'justify-end')}
          >
            <div className={cn('flex max-w-[88%] gap-3', isAssistant ? 'flex-row' : 'flex-row-reverse')}>
              {isAssistant ? (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 p-1">
                  <OriMascotStatic className="h-full w-full" />
                </div>
              ) : null}
              <div
                className={cn(
                  'rounded-3xl px-4 py-3 text-sm leading-7 shadow-lg transition-colors',
                  isAssistant
                    ? 'rounded-tl-md border border-border/40 bg-card/40 text-foreground backdrop-blur-md shadow-slate-200/50 dark:shadow-none'
                    : 'rounded-tr-md bg-primary/40 text-foreground backdrop-blur-md border border-primary/20 shadow-primary/10',
                )}
              >
                <FormattedMessage content={message.content} isAssistant={isAssistant} />
                <div
                  className={cn(
                    'mt-2 text-[10px] uppercase tracking-[0.2em]',
                    isAssistant ? 'text-muted-foreground' : 'text-primary/70',
                  )}
                >
                  {isAssistant ? 'Origin AI' : 'You'} · {formatRelativeTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function describeVoiceStatus(status: OriginAiVoiceStatus): string {
  switch (status) {
    case 'bootstrapping':
      return 'Preparing your voice session...';
    case 'connecting':
      return 'Connecting to Origin AI voice...';
    case 'listening':
      return 'Listening. Speak naturally.';
    case 'thinking':
      return 'Thinking through the reply...';
    case 'speaking':
      return 'Speaking the reply back to you.';
    case 'error':
      return 'Voice mode hit a snag.';
    default:
      return '';
  }
}

export default function OriginAiMentor({
  compact = false,
  onClose,
  autoAskSelectionNonce = 0,
  isSidebar = false,
  side = 'right',
  onSideToggle,
}: OriginAiMentorProps) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = React.useState<OriginAiSnapshot | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [voiceStatus, setVoiceStatus] = React.useState<OriginAiVoiceStatus>('idle');
  const [liveUserTranscript, setLiveUserTranscript] = React.useState('');
  const [liveAssistantTranscript, setLiveAssistantTranscript] = React.useState('');
  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const compactScrollRef = React.useRef<HTMLDivElement | null>(null);
  const voiceControllerRef = React.useRef<OriginAiVoiceController | null>(null);
  const lastAutoAskedSelectionNonceRef = React.useRef(0);
  const lastPageKeyRef = React.useRef<string | null>(null);

  const pageContext = useOriginAiPageContext(pathname || '/dashboard');
  const highlightedText = useHighlightedText();

  const {
    textTokensUsed,
    voiceSecondsUsed,
    textLimitTokens,
    voiceLimitSeconds,
    addTextUsage,
    startVoiceTracking,
    stopVoiceTracking,
    isTextQuotaReached,
    isVoiceQuotaReached,
    textProgress,
    voiceProgress
  } = useQuota();

  const remainingText = Math.max(0, textLimitTokens - textTokensUsed);
  const remainingVoiceMins = Math.max(0, Math.ceil((voiceLimitSeconds - voiceSecondsUsed) / 60));

  // Drive the 3D mascot from the live conversation state.
  const mascotState = useMentorMascotState({
    isLoading,
    isSending,
    voiceStatus,
    message,
    messageCount: snapshot?.session.messages.length ?? 0,
  });

  const loadSnapshot = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getOriginAiSession(pageContext);
      setSnapshot(data);
    } catch (error) {
      console.error('Failed to load Origin AI session', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load Origin AI');
    } finally {
      setIsLoading(false);
    }
  }, [pageContext]);

  React.useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [snapshot, isSending]);

  React.useEffect(() => {
    if (!compact || !compactScrollRef.current) {
      return;
    }

    compactScrollRef.current.scrollTop = compactScrollRef.current.scrollHeight;
  }, [compact, snapshot, isSending]);

  React.useEffect(() => {
    return () => {
      void voiceControllerRef.current?.stop();
      voiceControllerRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    // voiceStatus: 'listening', 'thinking', 'speaking', 'error', 'idle', 'bootstrapping', 'connecting'
    // We track when it's actively engaged in conversation (listening or speaking)
    if (voiceStatus === 'listening' || voiceStatus === 'speaking' || voiceStatus === 'thinking') {
      startVoiceTracking();
    } else {
      stopVoiceTracking();
    }
    return () => stopVoiceTracking();
  }, [voiceStatus, startVoiceTracking, stopVoiceTracking]);

  React.useEffect(() => {
    const pageKey = `${pageContext.pathname}|${pageContext.pageKind}|${pageContext.questionId ?? ''}`;

    if (lastPageKeyRef.current === null) {
      lastPageKeyRef.current = pageKey;
      return;
    }

    if (lastPageKeyRef.current !== pageKey) {
      clearHighlightedText();
      lastPageKeyRef.current = pageKey;
    }
  }, [pageContext.pathname, pageContext.pageKind, pageContext.questionId]);

  React.useEffect(() => {
    if (!voiceControllerRef.current) {
      return;
    }

    void voiceControllerRef.current.stop();
    voiceControllerRef.current = null;
    setVoiceStatus('idle');
    setLiveUserTranscript('');
    setLiveAssistantTranscript('');
  }, [pageContext.pathname, pageContext.pageKind]);

  React.useEffect(() => {
    if (!autoAskSelectionNonce || autoAskSelectionNonce === lastAutoAskedSelectionNonceRef.current) {
      return;
    }

    if (isLoading || isSending) {
      return;
    }

    const selectedText = getPendingHighlightedText()?.trim();
    lastAutoAskedSelectionNonceRef.current = autoAskSelectionNonce;

    if (!selectedText) {
      return;
    }

    const sendSelectionPrompt = async () => {
      setMessage('');
      setIsSending(true);

      try {
        const reply = await sendOriginAiMessage(
          'Explain the selected text in the current screen context.',
          pageContext,
          selectedText,
        );
        setSnapshot(reply);
      } catch (error) {
        console.error('Failed to send highlighted Origin AI prompt', error);
        toast.error(error instanceof Error ? error.message : 'Origin AI could not explain the selected text');
      } finally {
        setIsSending(false);
      }
    };

    void sendSelectionPrompt();
  }, [autoAskSelectionNonce, isLoading, isSending, pageContext]);

  const handleSend = async () => {
    const trimmed = message.trim();
    // Use the time-buffered highlight: even if the browser cleared the
    // selection (e.g. user clicked the input), the last valid highlight
    // survives for 3 seconds.
    const snappedHighlight = highlightedText || getPendingHighlightedText();
    const outboundMessage =
      trimmed || (snappedHighlight ? 'Explain the selected text in the current screen context.' : '');

    if (!outboundMessage) {
      return;
    }

    setMessage('');
    setIsSending(true);

    try {
      const reply = await sendOriginAiMessage(outboundMessage, pageContext, snappedHighlight);
      setSnapshot(reply);
      // Track usage
      const tokens = (reply.aiMessage.metadata?.tokensUsed as number) || 0;
      addTextUsage(tokens);
    } catch (error) {
      console.error('Failed to send Origin AI message', error);
      toast.error(error instanceof Error ? error.message : 'Origin AI could not reply');
      setMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleVoice = async () => {
    if (voiceControllerRef.current) {
      await voiceControllerRef.current.stop();
      voiceControllerRef.current = null;
      setVoiceStatus('idle');
      setLiveUserTranscript('');
      setLiveAssistantTranscript('');
      return;
    }

    if (isVoiceQuotaReached) {
      toast.error("Daily voice quota reached. Please try again tomorrow.");
      return;
    }

    try {
      const controller = await startOriginAiVoiceMode(pageContext, () => getHighlightedText(), {
        onStatusChange: (status) => {
          setVoiceStatus(status);
          if (status === 'idle') {
            setLiveUserTranscript('');
            setLiveAssistantTranscript('');
          }
        },
        onUserTranscript: (text) => {
          setLiveUserTranscript(text);
        },
        onAssistantTranscript: (text) => {
          setLiveAssistantTranscript(text);
        },
        onReplyCommitted: (reply) => {
          setSnapshot(reply);
          setLiveUserTranscript('');
          setLiveAssistantTranscript('');
        },
        onError: (errorMessage) => {
          toast.error(errorMessage);
          setVoiceStatus('error');
        },
      });

      voiceControllerRef.current = controller;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Origin AI voice mode could not start.');
      setVoiceStatus('error');
    }
  };

  const isVoiceActive = voiceStatus !== 'idle';
  const voiceStatusText = describeVoiceStatus(voiceStatus);

  const shellClassName = compact
    ? cn(
        'flex h-full flex-col overflow-hidden transition-colors',
        !isSidebar && 'rounded-[28px] border border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl'
      )
    : 'flex h-full min-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-[32px] border border-border/40 bg-card/60 backdrop-blur-xl text-foreground shadow-[0_25px_80px_rgba(2,6,23,0.15)] transition-colors';

  if (compact) {
    return (
      <div id="tutorial-mentor" className={shellClassName} data-origin-ai-root="true">
        <div className="flex items-center justify-between border-b border-border/40 bg-indigo-500/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/20 bg-muted p-1">
              <OriMascot state={mascotState} title="Origin AI" className="h-full w-full" />
            </div>
            {onSideToggle && (
              <button
                onClick={onSideToggle}
                className="p-1 rounded-md hover:bg-foreground/5 text-muted-foreground transition-colors shrink-0"
                title={side === 'left' ? "Move to Right" : "Move to Left"}
              >
                {side === 'left' ? <PanelRight className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Origin AI</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-300">
                  online
                </span>
              </div>
              <p className="max-w-[12rem] truncate text-[11px] leading-4 text-muted-foreground">
                Friendly mentor with page awareness and study memory.
              </p>
            </div>
          </div>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="shrink-0 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            >
              Close
            </Button>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-b border-border/40 px-4 py-3">
          {snapshot ? <PolicyBadge snapshot={snapshot} /> : null}
          {snapshot ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-foreground/5 px-2.5 py-1">
                Page: {snapshot.pageContext.pageKind.replace(/_/g, ' ')}
              </span>
            </div>
          ) : null}
        </div>

        <div
          ref={compactScrollRef}
          className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {isLoading ? (
            <div className="flex h-full min-h-[140px] items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading Origin AI...
            </div>
          ) : snapshot ? (
            <MessageList snapshot={snapshot} />
          ) : (
            <div className="flex h-full min-h-[140px] items-center justify-center text-slate-400">
              Origin AI could not load.
            </div>
          )}
          <AnimatePresence>
            {isSending ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mt-4 flex justify-start"
              >
                <div className="rounded-3xl rounded-tl-md border border-border/60 bg-muted/30 px-4 py-3 text-sm text-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium opacity-80">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div ref={scrollAnchorRef} />
        </div>

        <div className="shrink-0 border-t border-border/40 bg-card/40 px-3 py-3">
          {isVoiceActive ? (
            <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-primary">{voiceStatusText}</div>
                <span className="rounded-full bg-primary/20 px-2 py-1 text-[10px] uppercase tracking-[0.2em] font-black text-primary">
                  {voiceStatus.replace(/_/g, ' ')}
                </span>
              </div>
              {liveUserTranscript ? (
                <p className="mt-2 line-clamp-2 text-foreground/80 overflow-hidden">You: {liveUserTranscript}</p>
              ) : null}
              {liveAssistantTranscript ? (
                <p className="mt-1 line-clamp-2 text-muted-foreground overflow-hidden">Origin AI: {liveAssistantTranscript}</p>
              ) : null}
            </div>
          ) : null}
          {highlightedText ? (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <span className="shrink-0 font-black tracking-wider text-primary">Selected </span>
              <FormattedMessage content={highlightedText} inline className="line-clamp-1 flex-1 font-medium text-foreground/80" />
              <button
                type="button"
                onClick={() => clearHighlightedText()}
                className="rounded-full p-1 text-primary/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Clear highlighted text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className="flex min-w-0 items-end gap-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={1}
                    disabled={isTextQuotaReached}
                    placeholder={
                      isTextQuotaReached
                        ? 'Daily text quota reached...'
                        : highlightedText
                        ? 'Ask about the selected text...'
                        : snapshot?.pagePolicy.mode === 'answer_blocked'
                          ? 'Ask for strategy, not answers...'
                          : snapshot?.pagePolicy.mode === 'hint_only'
                            ? 'Ask for a hint or a concept nudge...'
                            : 'Ask Origin AI anything about your studies...'
                    }
                    className="no-scrollbar min-w-0 flex-1 resize-none rounded-3xl border border-border/40 bg-muted/40 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/40 focus:bg-muted/60 disabled:opacity-50"
                  />
                </TooltipTrigger>
                <TooltipContent className="p-4 w-64 bg-card border-border/40 shadow-xl backdrop-blur-md">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining Text Quota</span>
                      <span className="text-xs font-bold text-primary">{Math.max(0, Math.round(100 - textProgress))}%</span>
                    </div>
                    <Progress value={textProgress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {remainingText.toLocaleString()} tokens remaining today.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => void handleToggleVoice()}
                    disabled={isVoiceQuotaReached && !isVoiceActive}
                    className={cn(
                      'h-12 w-12 shrink-0 rounded-3xl px-0 py-0 text-foreground transition-colors',
                      isVoiceActive
                        ? 'border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        : 'border border-border/40 bg-muted/40 hover:bg-muted/80',
                      isVoiceQuotaReached && !isVoiceActive && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {voiceStatus === 'bootstrapping' || voiceStatus === 'connecting' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isVoiceActive ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="p-4 w-64 bg-card border-border/40 shadow-xl backdrop-blur-md">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining Voice Quota</span>
                      <span className="text-xs font-bold text-primary">{Math.max(0, Math.round(100 - voiceProgress))}%</span>
                    </div>
                    <Progress value={voiceProgress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {remainingVoiceMins} minutes left for today.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || isTextQuotaReached || (!message.trim() && !highlightedText)}
                className="h-12 w-12 shrink-0 rounded-3xl bg-primary px-0 py-0 text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </TooltipProvider>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="tutorial-mentor" className={shellClassName} data-origin-ai-root="true">
      <div className={cn('flex items-center justify-between border-b border-border/40 bg-primary/10', compact ? 'px-4 py-3' : 'px-5 py-4')}>
        <div className="flex items-center gap-3">
          <div className={cn('relative flex items-center justify-center overflow-hidden rounded-full border border-border/20 bg-muted p-1', compact ? 'h-10 w-10' : 'h-11 w-11')}>
            <OriMascot state={mascotState} title="Origin AI" className="h-full w-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Origin AI</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-300">
                online
              </span>
            </div>
            <p className={cn('text-muted-foreground', compact ? 'max-w-[13rem] text-[11px] leading-4' : 'text-xs')}>
              Friendly mentor with page awareness, memory, and just enough sarcasm to be useful.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!compact && (
            <Button
              type="button"
              variant="outline"
              onClick={loadSnapshot}
              className="border-border/40 bg-muted/20 text-foreground/80 hover:bg-muted/40"
            >
              Refresh
            </Button>
          )}
          {compact && onClose ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Close
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn('grid flex-1 gap-0', compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.4fr_0.9fr]')}>
        <div className="flex min-h-0 flex-col">
          <div className={cn('space-y-3 border-b border-border/40', compact ? 'px-4 py-3' : 'px-5 py-4')}>
            {snapshot ? <PolicyBadge snapshot={snapshot} /> : null}
            {snapshot ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-foreground/5 px-2.5 py-1">
                  Page: {snapshot.pageContext.pageKind.replace(/_/g, ' ')}
                </span>
                {!compact && snapshot.memory.lastWeakTopics.length > 0 ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    Weak topics: {snapshot.memory.lastWeakTopics.slice(0, 2).join(', ')}
                  </span>
                ) : null}
                {!compact && snapshot.memory.pendingDppCount > 0 ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    Pending DPPs: {snapshot.memory.pendingDppCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {compact ? (
            <div ref={compactScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {isLoading ? (
                <div className="flex h-full min-h-[160px] items-center justify-center text-slate-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Origin AI...
                </div>
              ) : snapshot ? (
                <MessageList snapshot={snapshot} />
              ) : (
                <div className="flex h-full min-h-[160px] items-center justify-center text-slate-400">
                  Origin AI could not load.
                </div>
              )}
              <AnimatePresence>
                {isSending ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="mt-4 flex justify-start"
                  >
                    <div className="rounded-3xl rounded-tl-md border border-border/40 bg-muted/40 px-4 py-3 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Thinking...
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div ref={scrollAnchorRef} />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1 px-5 py-5">
              {isLoading ? (
                <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Origin AI...
                </div>
              ) : snapshot ? (
                <MessageList snapshot={snapshot} />
              ) : (
                <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
                  Origin AI could not load.
                </div>
              )}
              <AnimatePresence>
                {isSending ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="mt-4 flex justify-start"
                  >
                    <div className="rounded-3xl rounded-tl-md border border-border/40 bg-muted/40 px-4 py-3 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Thinking...
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div ref={scrollAnchorRef} />
            </ScrollArea>
          )}

          <div className={cn('border-t border-border/40', compact ? 'px-3 py-3' : 'px-5 py-4')}>
            {isVoiceActive ? (
              <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-primary">{voiceStatusText}</div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
                    {voiceStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                {liveUserTranscript ? (
                  <p className="mt-2 line-clamp-2 text-foreground/80">You: {liveUserTranscript}</p>
                ) : null}
                {liveAssistantTranscript ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">Origin AI: {liveAssistantTranscript}</p>
                ) : null}
              </div>
            ) : null}
            {highlightedText ? (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-foreground">
                <span className="shrink-0 font-semibold tracking-wider text-primary">Selected </span>
                <FormattedMessage content={highlightedText} inline className="line-clamp-1 flex-1 opacity-80" />
                <button
                  type="button"
                  onClick={() => clearHighlightedText()}
                  className="rounded-full p-1 text-blue-200/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Clear highlighted text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <div className={cn('flex items-end', compact ? 'gap-2' : 'gap-3')}>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      rows={compact ? 1 : 3}
                      disabled={isTextQuotaReached}
                      placeholder={
                        isTextQuotaReached
                          ? 'Daily text quota reached...'
                          : highlightedText
                          ? 'Ask about the selected text...'
                          : snapshot?.pagePolicy.mode === 'answer_blocked'
                            ? 'Ask for strategy, not answers...'
                            : snapshot?.pagePolicy.mode === 'hint_only'
                              ? 'Ask for a hint or a concept nudge...'
                              : 'Ask Origin AI anything about your studies...'
                      }
                      className={cn(
                        'flex-1 resize-none rounded-3xl border border-muted dark:border-slate-800 bg-muted/40 px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:bg-muted/60 disabled:opacity-50',
                        compact ? 'min-h-[48px] max-h-24 py-3 leading-6' : 'min-h-[56px] py-3',
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="p-4 w-64 bg-card border-border/40 shadow-xl backdrop-blur-md z-[100]">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining Text Quota</span>
                        <span className="text-xs font-bold text-primary">{Math.max(0, Math.round(100 - textProgress))}%</span>
                      </div>
                      <Progress value={textProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {remainingText.toLocaleString()} tokens remaining today.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={() => void handleToggleVoice()}
                      disabled={isVoiceQuotaReached && !isVoiceActive}
                      className={cn(
                        'rounded-3xl text-foreground transition-colors',
                        isVoiceActive
                          ? 'border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                          : 'border border-muted dark:border-slate-800 bg-muted/40 hover:bg-muted/80',
                        compact ? 'h-12 w-12 shrink-0 px-0 py-0' : 'h-auto px-4 py-3',
                        isVoiceQuotaReached && !isVoiceActive && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {voiceStatus === 'bootstrapping' || voiceStatus === 'connecting' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isVoiceActive ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="p-4 w-64 bg-card border-border/40 shadow-xl backdrop-blur-md z-[100]">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining Voice Quota</span>
                        <span className="text-xs font-bold text-primary">{Math.max(0, Math.round(100 - voiceProgress))}%</span>
                      </div>
                      <Progress value={voiceProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {remainingVoiceMins} minutes left for today.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isSending || isTextQuotaReached || (!message.trim() && !highlightedText)}
                  className={cn(
                    'rounded-3xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50',
                    compact ? 'h-12 w-12 shrink-0 px-0 py-0' : 'h-auto px-4 py-3',
                  )}
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </TooltipProvider>
            </div>
            {compact ? null : (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Origin AI knows your recent performance, pending DPPs, the page you are on, and now supports beta voice mode.
                </p>
              </div>
            )}
          </div>
        </div>

        {!compact && snapshot ? (
          <aside className="border-t border-border/40 px-5 py-5 xl:border-t-0 xl:border-l xl:border-border/40">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-muted dark:border-slate-800 bg-muted/30 p-4 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-500">
                  Mentor Memory
                </div>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {snapshot.memory.preferredName}, here’s what I’m tracking.
                </h3>
                <p className="mt-2 text-sm leading-6 text-foreground/70">{snapshot.memory.identitySummary}</p>
                <div className="mt-4 space-y-2 text-sm text-foreground/70">
                  <div>Current streak: {snapshot.memory.currentStreak} day(s)</div>
                  <div>Pending DPPs: {snapshot.memory.pendingDppCount}</div>
                  <div>Pending assignments: {snapshot.memory.pendingAssignmentCount}</div>
                  {snapshot.memory.lastTestSummary ? (
                    <p className="rounded-2xl bg-foreground/5 px-3 py-2 text-foreground/70">
                      Last test summary: {snapshot.memory.lastTestSummary}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Live Reminders
                </div>
                <ReminderCards snapshot={snapshot} />
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
