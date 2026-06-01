'use client';
import { Fragment, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, Send, ImagePlus, Mic, MicOff,
  X, Sparkles, Plus, Atom,
  FlaskConical, Calculator, Leaf, PanelLeft, PanelLeftClose, Trash2,
  Database, MessageCircle
} from 'lucide-react';
import { useHighlightedText, clearHighlightedText, getHighlightedText, getPendingHighlightedText } from '@/features/origin-ai/highlight-capture';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  DoubtSession,
  User,
  ChatMessage as ChatMessageType,
  OriginAiSession,
  OriginAiThread,
  OriginAiReply,
} from '@/types';
import {
  buildOriginAiPageContext,
  createOriginAiThread,
  deleteOriginAiThread,
  getOriginAiThreadSnapshot,
  listOriginAiChapters,
  listOriginAiThreads,
  renameOriginAiThread,
  sendOriginAiMessage,

  solveOriginAiImage,
  type ChapterItem,
  type ImageSolveResult,
} from '@/features/origin-ai/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { useQuota } from '@/context/QuotaContext';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function renderInlineSegments(value: string, keyPrefix: string) {
    return <FormattedMessage content={value || ''} inline />;
}

const SESSION_CACHE_KEY = 'doubt_sessions_cache';
const LAST_SUBJECT_KEY = 'doubt_last_subject';
const STEP_MARKER = '<!-- step -->';

type SubjectKey = 'phy' | 'chem' | 'math' | 'bio';
const SUBJECT_DISPLAY: Record<SubjectKey, string> = {
  phy: 'Physics',
  chem: 'Chemistry',
  math: 'Mathematics',
  bio: 'Biology',
};

function isSubjectKey(value: string): value is SubjectKey {
  return Object.prototype.hasOwnProperty.call(SUBJECT_DISPLAY, value);
}

function formatSubjectForContext(subject?: string | null): string | null {
  if (!subject) {
    return null;
  }

  return isSubjectKey(subject) ? SUBJECT_DISPLAY[subject] : subject;
}

function getChapterContextTitle(session: DoubtSession | null): string | null {
  const title = session?.title?.trim();
  if (!title || title === 'Doubt Thread' || title.toLowerCase().includes('image analysis')) {
    return null;
  }

  return title;
}

// Adapt an OriginAiThread (list payload, no messages) into the DoubtSession shape
// the UI already speaks. We use `threadId` as the canonical id so PATCH/DELETE
// against /origin-ai/threads/:id keep working.
function threadToSession(thread: OriginAiThread): DoubtSession {
  return {
    id: thread.threadId,
    title: thread.title,
    subject: thread.subject ?? undefined,
    activeConcept: thread.activeConcept,
    messages: [],
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function snapshotToSession(session: OriginAiSession): DoubtSession {
  return {
    id: session.threadId ?? session.id,
    title: session.title,
    subject: session.subject ?? undefined,
    activeConcept: session.activeConcept,
    messages: session.messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function repairBrokenLatexEscapes(value: string): string {
  return value
    .replace(/\t(?=[A-Za-z])/g, '\\t')
    .replace(/\r(?=[A-Za-z])/g, '\\r')
    .replace(/\f(?=[A-Za-z])/g, '\\f')
    .replace(/\u0008(?=[A-Za-z])/g, '\\b');
}

// Progressive revelation and response steps
function extractResponseSteps(content: string): string[] {
  return content
    .split(STEP_MARKER)
    .map((step) => step.trim())
    .filter(Boolean);
}

function shouldUseProgressiveReveal(message: ChatMessageType): boolean {
  const metadata = message.metadata ?? {};
  const policyMode = typeof metadata.policyMode === 'string' ? metadata.policyMode : null;
  const mode = typeof metadata.mode === 'string' ? metadata.mode : null;
  const source = typeof metadata.source === 'string' ? metadata.source : null;

  return (
    policyMode === 'hint_only' ||
    mode === 'hint' ||
    source === 'origin_ai_hint_guardrail' ||
    source === 'subject_kb_hint'
  );
}

interface DoubtSolverProps {
  onBack: () => void;
  user: User;
}

export default function DoubtSolver({ onBack, user }: DoubtSolverProps) {
  const [sessions, setSessions] = useState<DoubtSession[]>([]);
  const [activeSession, setActiveSession] = useState<DoubtSession | null>(null);
  const [viewMode, setViewMode] = useState<'selection' | 'chapter' | 'chat'>('selection');
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const [message, setMessage] = useState('');
  const highlightedText = useHighlightedText();
  const [isTyping, setIsTyping] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editingSidebarId, setEditingSidebarId] = useState<string | null>(null);
  const [sidebarEditValue, setSidebarEditValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechRecognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastImageContextRef = useRef<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const { 
    addTextUsage, 
    getRemainingTokens,
    textProgress,
    voiceProgress,
    getRemainingVoiceTime
  } = useQuota();
  const { addNotification } = useNotifications();
  const { refreshUser } = useAuth();
  const isTextQuotaReached = textProgress >= 100;

  // Track if we've already notified for this session
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (isTextQuotaReached && !hasNotifiedRef.current) {
      addNotification({
        title: 'Quota Exhausted',
        message: 'Your daily text quota for AI Explainer has been reached. Upgrade for unlimited access.',
        type: 'warning'
      });
      hasNotifiedRef.current = true;
    } else if (!isTextQuotaReached) {
      hasNotifiedRef.current = false;
    }
  }, [isTextQuotaReached, addNotification]);

  const sessionCacheKey = `${SESSION_CACHE_KEY}_${user.id}`;
  const originAiPageContext = useMemo(() => {
    const subject = activeSession?.subject ?? selectedSubject ?? null;
    const subjectLabel = formatSubjectForContext(subject);
    const chapterTitle = getChapterContextTitle(activeSession);
    const sessionTitle = activeSession?.title?.trim() || null;

    return {
      ...buildOriginAiPageContext('/doubt-solver'),
      questionTitle: sessionTitle ?? (subjectLabel ? `${subjectLabel} Doubt Solver` : 'Doubt Solver'),
      questionSubject: subjectLabel,
      questionChapter: chapterTitle,
      questionConcept: activeSession?.activeConcept ?? null,
      activeSubject: subject,
      selectedChapters: chapterTitle ? [chapterTitle] : [],
    };
  }, [
    activeSession?.activeConcept,
    activeSession?.subject,
    activeSession?.title,
    selectedSubject,
  ]);

  usePublishOriginAiPageContext(originAiPageContext);

  const persistSessionCache = useCallback((nextSessions: DoubtSession[]) => {
    const cacheData = nextSessions.map((session) => {
      const { messages, ...rest } = session;
      void messages;
      return rest;
    });
    try {
      localStorage.setItem(sessionCacheKey, JSON.stringify(cacheData));
    } catch {
      console.warn("Storage quota exceeded, cache not updated");
    }
  }, [sessionCacheKey]);

  const mergeReplyIntoSession = (
    baseSession: DoubtSession | null,
    reply: { session: DoubtSession; userMessage: ChatMessageType; aiMessage: ChatMessageType }
  ): DoubtSession => {
    const existingMessages = baseSession?.messages || [];
    const incomingMessages = reply.session.messages?.length
      ? reply.session.messages
      : [...existingMessages, reply.userMessage, reply.aiMessage];

    const dedupedMessages = incomingMessages.filter((message, index, all) => (
      all.findIndex(candidate => candidate.id === message.id) === index
    ));

    return {
      ...reply.session,
      id: reply.session.id || baseSession?.id || '',
      title: reply.session.title || baseSession?.title || 'Doubt Thread',
      subject: reply.session.subject ?? baseSession?.subject,
      activeConcept: reply.session.activeConcept ?? baseSession?.activeConcept ?? null,
      messages: dedupedMessages,
    };
  };

  const removeSessionLocally = useCallback((sessionId: string) => {
    setSessions(prev => {
      const nextSessions = prev.filter(session => session.id !== sessionId);
      persistSessionCache(nextSessions);
      return nextSessions;
    });
  }, [persistSessionCache]);

  useEffect(() => {
    if (activeSession) {
      setEditedTitle(activeSession.title);
      setViewMode('chat');
    }
  }, [activeSession]);

  const handleUpdateTitle = async (sessionId?: string, newTitle?: string) => {
    const targetSessionId = sessionId || activeSession?.id;
    const targetTitle = newTitle || editedTitle;

    if (!targetSessionId || !targetTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const updated = threadToSession(
        await renameOriginAiThread(targetSessionId, { title: targetTitle.trim() }),
      );
      if (activeSession?.id === updated.id) {
        // Preserve loaded messages — rename returns metadata only.
        setActiveSession({ ...updated, messages: activeSession.messages });
      }

      setSessions(prev => {
        const newSessions = prev.map(s => s.id === updated.id ? { ...updated, messages: s.messages } : s);
        persistSessionCache(newSessions);
        return newSessions;
      });
    } catch (error) {
      console.error("Failed to update title", error);
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    // Load from cache first
    const cached = localStorage.getItem(sessionCacheKey);
    if (cached) {
      try {
        setSessions(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to parse cache", e);
      }
    }

    const fetchSessions = async () => {
      try {
        const threads = await listOriginAiThreads();
        const data = threads.map(threadToSession);
        setSessions(data);
        persistSessionCache(data);
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      }
    };
    fetchSessions();
  }, [persistSessionCache, sessionCacheKey]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isTyping]);

  const handleSendMessage = async (overrideText?: string) => {
    const currentMessage = overrideText ?? message;
    // Use the time-buffered highlight: even if the browser cleared the
    // selection (e.g. user clicked the input), the last valid highlight
    // survives for 3 seconds.
    const snappedHighlight = highlightedText || getPendingHighlightedText();
    const outboundMessage =
      currentMessage.trim() || (snappedHighlight ? 'Explain the selected text in the current screen context.' : '');
    if (!outboundMessage || !activeSession) return;

    setMessage('');
    setIsTyping(true);

    try {
      const chapterTitle = getChapterContextTitle(activeSession);
      const ctx: Record<string, unknown> = {
        ...buildOriginAiPageContext('/doubt-solver'),
        activeSubject: activeSession.subject ?? null,
        questionChapter: chapterTitle,
        questionSubject: formatSubjectForContext(activeSession.subject ?? null),
        questionConcept: activeSession.activeConcept ?? null,
      };
      if (lastImageContextRef.current) {
        ctx.imageContext = lastImageContextRef.current;
        lastImageContextRef.current = null;
      }
      const response = await sendOriginAiMessage(outboundMessage, ctx, snappedHighlight, activeSession.id);
      
      // Update tokens
      const userTokens = (response.userMessage.metadata?.tokensUsed as number) || 0;
      const aiTokens = (response.aiMessage.metadata?.tokensUsed as number) || 0;
      addTextUsage(userTokens + aiTokens);
      void refreshUser();

      const mergedSession = mergeReplyIntoSession(activeSession, replyToDoubtReply(response));

      setActiveSession(mergedSession);
      setSessions(prev => {
        const nextSessions = prev.map(session => (
          session.id === mergedSession.id ? { ...mergedSession, messages: session.messages } : session
        ));
        persistSessionCache(nextSessions);
        return nextSessions;
      });
    } catch (error) {
      console.error("Failed to send message", error);
      if (error instanceof Error && error.message.includes('daily AI usage limit')) {
        void refreshUser();
      }
      toast.error("Couldn't send your message — please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  // Adapt the OriginAiReply (session/userMessage/aiMessage) to the legacy
  // DoubtSession-shaped reply that mergeReplyIntoSession expects.
  const replyToDoubtReply = (reply: OriginAiReply) => ({
    session: snapshotToSession(reply.session),
    userMessage: reply.userMessage,
    aiMessage: reply.aiMessage,
  });

  const createNewSession = async (title: string, subject?: string | null) => {
    try {
      const thread = await createOriginAiThread({ title, subject: subject ?? null });
      const newSession = threadToSession(thread);
      setSessions(prev => {
        const existing = prev.some(session => session.id === newSession.id);
        const newSessions = existing
          ? prev.map(session => (session.id === newSession.id ? newSession : session))
          : [newSession, ...prev];
        persistSessionCache(newSessions);
        return newSessions;
      });
      setActiveSession(newSession);
      setViewMode('chat');
      if (subject) {
        try { localStorage.setItem(lastSubjectKey, subject); } catch {}
      }
      return newSession;
    } catch (error) {
      console.error("Failed to create session", error);
      toast.error("Couldn't start a new chat — please try again.");
      return null;
    }
  };

  // Load the full message transcript for a thread when the user clicks it in the sidebar.
  const handleSelectSession = useCallback(async (session: DoubtSession) => {
    setActiveSession(session);
    setViewMode('chat');
    if (session.messages.length > 0) return;
    try {
      const snapshot = await getOriginAiThreadSnapshot(session.id, {
        title: session.title,
        subject: session.subject ?? null,
        activeConcept: session.activeConcept ?? null,
      });
      const hydrated = snapshotToSession(snapshot.session);

      setActiveSession(prev => (prev?.id === hydrated.id ? hydrated : prev));
      setSessions(prev => prev.map(s => (s.id === hydrated.id ? hydrated : s)));
    } catch (error) {
      console.error("Failed to load thread", error);
    }
  }, []);

  const handleDeleteSession = useCallback(async (session: DoubtSession) => {
    if (!window.confirm(`Delete "${session.title}"? This removes the full thread history.`)) {
      return;
    }

    const wasActive = activeSession?.id === session.id;
    try {
      await deleteOriginAiThread(session.id);
      removeSessionLocally(session.id);
      if (wasActive) {
        setActiveSession(null);
        setViewMode('selection');
      }
    } catch (error) {
      console.error("Failed to delete thread", error);
      toast.error("Couldn't delete that chat — please try again.");
    }
  }, [activeSession?.id, removeSessionLocally]);

  const lastSubjectKey = `${LAST_SUBJECT_KEY}_${user.id}`;
  const lastMentorSession = sessions[0];

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });

  const defaultImageSubject = (): SubjectKey => {
    try {
      const saved = localStorage.getItem(lastSubjectKey);
      if (saved === 'phy' || saved === 'chem' || saved === 'math' || saved === 'bio') {
        return saved;
      }
    } catch {}
    return 'phy';
  };

  const handleImageFileUpload = async (file: File, preferredSession?: DoubtSession | null) => {
    let session = preferredSession ?? activeSession;
    if (!session) {
      const subjectKey = defaultImageSubject();
      const created = await createNewSession(
        `${SUBJECT_DISPLAY[subjectKey]} - Image Analysis`,
        subjectKey,
      );
      if (!created) return;
      session = created;
    }

    setShowImageUpload(false);
    setViewMode('chat');
    setIsProcessingImage(true);
    setIsTyping(true);

    const tempId = `pending-image-${Date.now()}`;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(',')[1] ?? dataUrl;
      const mimeType = file.type || 'image/png';
      const tempUserMsg: ChatMessageType = {
        id: tempId,
        role: 'user',
        content: 'I uploaded an image of a problem. Can you solve it?',
        timestamp: new Date(),
        image: dataUrl,
        metadata: { pendingUpload: true },
      };

      setActiveSession(prev => {
        const base = prev?.id === session!.id ? prev : session!;
        return {
          ...base,
          messages: [...base.messages, tempUserMsg],
          updatedAt: new Date(),
        };
      });

      const result = await solveOriginAiImage(
        base64,
        mimeType,
        session.subject,
        session.id,
      );

      addTextUsage(result.tokensUsed || 0);
      void refreshUser();

      const fallbackAiContent = [
        result.matchFound && result.matchDetails
          ? `📚 **Found in ${result.matchDetails.source === 'ogcode' ? 'OGCode Database' : 'Knowledge Base'}** (${Math.round(result.matchDetails.score * 100)}% match)\n\n`
          : `✨ **Generated by Origin AI** (new problem)\n\n`,
        result.extractedQuestion ? `**Extracted Question:** ${result.extractedQuestion}\n\n` : '',
        result.answer,
        result.savedToDb ? '\n\n✅ _This problem has been saved to our database for future reference._' : '',
      ].join('');

      const persistedUserMsg: ChatMessageType = result.userMessage ?? {
        ...tempUserMsg,
        id: result.userMessageId ?? tempUserMsg.id,
        image: result.attachment?.url ?? dataUrl,
        attachments: result.attachment ? [result.attachment] : undefined,
        metadata: {
          attachments: result.attachment ? [result.attachment] : undefined,
          source: 'user',
        },
      };
      const persistedAiMsg: ChatMessageType = result.aiMessage ?? {
        id: result.aiMessageId ?? `${tempId}-assistant`,
        role: 'assistant',
        content: fallbackAiContent,
        timestamp: new Date(),
        metadata: { source: result.source, modelUsed: result.modelUsed },
      };

      lastImageContextRef.current = `The student just uploaded an image of this problem: "${result.extractedQuestion || persistedUserMsg.content}". The solution provided was: "${result.answer.slice(0, 800)}"`;

      setActiveSession(prev => {
        const base = prev?.id === session!.id ? prev : session!;
        const withoutTemp = base.messages.filter(m => m.id !== tempId);
        const mergedMessages = [...withoutTemp, persistedUserMsg, persistedAiMsg].filter((msg, index, all) => (
          all.findIndex(candidate => candidate.id === msg.id) === index
        ));
        return {
          ...base,
          messages: mergedMessages,
          updatedAt: new Date(),
        };
      });

      setSessions(prev => {
        const target = { ...session!, updatedAt: new Date(), messages: [] };
        const exists = prev.some(s => s.id === target.id);
        const nextSessions = exists
          ? prev.map(s => (s.id === target.id ? { ...target, messages: s.messages } : s))
          : [{ ...target, messages: [] }, ...prev];
        persistSessionCache(nextSessions);
        return nextSessions;
      });
    } catch (error) {
      console.error('Image solve failed', error);
      setActiveSession(prev => (
        prev?.id === session?.id
          ? { ...prev, messages: prev.messages.filter(m => m.id !== tempId) }
          : prev
      ));
      toast.error(error instanceof Error ? error.message : 'Could not process the image — please try again.');
    } finally {
      setIsProcessingImage(false);
      setIsTyping(false);
    }
  };

  const handleSelectSubject = async (subjectKey: SubjectKey) => {
    setSelectedSubject(subjectKey);
    setViewMode('chapter');
    setChaptersLoading(true);
    try {
      const chapterList = await listOriginAiChapters(subjectKey);
      setChapters(chapterList);
    } catch (error) {
      console.error('Failed to load chapters', error);
      toast.error('Could not load chapters — please try again.');
      setViewMode('selection');
    } finally {
      setChaptersLoading(false);
    }
  };

  const handleSelectChapter = async (chapter: ChapterItem) => {
    if (!selectedSubject) return;
    const subjectName = SUBJECT_DISPLAY[selectedSubject];
    const session = await createNewSession(
      `${chapter.name}`,
      selectedSubject,
    );
    if (session) {
      // Auto-send first message asking AI to explain the chapter
      setIsTyping(true);
      try {
        const ctx = {
          ...buildOriginAiPageContext('/doubt-solver'),
          activeSubject: selectedSubject,
          questionChapter: chapter.name,
        };
        const autoMessage = `Explain all the concepts of the chapter "${chapter.name}" in ${subjectName} step by step. Start from the basics and cover every important concept, formula, and example.`;
        const response = await sendOriginAiMessage(autoMessage, ctx, null, session.id);
        const mergedSession = mergeReplyIntoSession(session, replyToDoubtReply(response));
        setActiveSession(mergedSession);
        setSessions(prev => {
          const nextSessions = prev.map(s =>
            s.id === mergedSession.id ? { ...mergedSession, messages: s.messages } : s
          );
          persistSessionCache(nextSessions);
          return nextSessions;
        });
      } catch (error) {
        console.error('Failed to start chapter explanation', error);
        toast.error('Could not start the explanation — please try again.');
      } finally {
        setIsTyping(false);
      }
    }
  };

  const startNewChatFromCTA = () => {
    // Go to subject selection
    setViewMode('selection');
  };

  return (
    <div className="h-full min-h-0 w-full bg-background text-foreground flex flex-col font-sans relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 30%, rgba(225, 29, 72, 0.15) 0%, transparent 40%),
                           radial-gradient(circle at 20% 70%, rgba(251, 113, 133, 0.1) 0%, transparent 40%)`
        }}>
      </div>

      {/* Fixed Header */}
      <header className="relative z-30 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border/40 bg-card/60 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => {
              if (viewMode === 'chat') {
                setViewMode(selectedSubject ? 'chapter' : 'selection');
                setActiveSession(null);
              } else if (viewMode === 'chapter') {
                setViewMode('selection');
                setSelectedSubject(null);
              } else {
                onBack();
              }
            }}
            className="p-1 sm:p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>

          {viewMode === 'chat' && activeSession && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 sm:p-2 rounded-lg text-muted-foreground hover:bg-muted/10 transition-colors inline-flex lg:inline-flex"
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-rose-600/10 border border-rose-500/20 flex items-center justify-center shadow-lg overflow-hidden">
              <img src="/ai-bot.png" alt="AI" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="flex flex-col">
            {viewMode === 'chat' && activeSession && isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  onBlur={() => handleUpdateTitle()}
                  className="bg-muted border border-rose-500/30 rounded px-2 py-0.5 text-xs sm:text-sm text-foreground focus:outline-none focus:border-rose-500 w-32 sm:w-40"
                />
              </div>
            ) : (
              <div
                className={`flex items-center gap-1.5 sm:gap-2 ${activeSession ? 'cursor-pointer group' : ''}`}
                onClick={() => activeSession && setIsEditingTitle(true)}
              >
                <h1 className="text-sm sm:text-xl font-bold text-foreground tracking-wide leading-none truncate max-w-[140px] sm:max-w-none">
                  {viewMode === 'chat' && activeSession ? activeSession.title : 'AI Explainer'}
                </h1>
                {activeSession && (
                  <Sparkles className="w-3 h-3 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            )}
            {/* <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1">24/7 Academic Mentor</p> */}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400 uppercase">System Online</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex overflow-hidden">
        {viewMode === 'selection' ? (
          <SelectionView
            onCreate={(title, sub) => handleSelectSubject(sub)}
            onUpload={() => setShowImageUpload(true)}
            sessions={sessions}
            onSelectSession={handleSelectSession}
            lastSession={lastMentorSession}
            onUpdateTitle={handleUpdateTitle}
            onStartNewChat={startNewChatFromCTA}
            onDeleteSession={handleDeleteSession}
            onGeneralChat={async () => {
              const session = await createNewSession('General Doubt Session', null);
              if (session) {
                setViewMode('chat');
              }
            }}
          />
        ) : viewMode === 'chapter' && selectedSubject ? (
          <ChapterSelectionView
            subject={selectedSubject}
            chapters={chapters}
            loading={chaptersLoading}
            onSelectChapter={handleSelectChapter}
            onBack={() => {
              setViewMode('selection');
              setSelectedSubject(null);
            }}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Sidebar & Backdrop (Mobile optimized) */}
            <AnimatePresence>
              {isSidebarOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                  />
                  <motion.aside
                    initial={{ x: -288, opacity: 0 }}
                    animate={{ x: 0, opacity: 1, width: 288 }}
                    exit={{ x: -288, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className={cn(
                      "absolute lg:relative z-40 h-full flex flex-col border-r border-border/40 bg-card/95 lg:bg-card/30 backdrop-blur-2xl lg:backdrop-blur-none overflow-hidden shadow-2xl lg:shadow-none",
                      "top-0 left-0 bottom-0"
                    )}
                  >
                  <div className="p-4 sm:p-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-6 px-2">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex-1">Recent Sessions</h3>
                      <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all outline-none"
                        title="Hide Sidebar"
                      >
                        <PanelLeftClose className="w-4 h-4" />
                      </button>
                      <button
                        onClick={startNewChatFromCTA}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                        title="New Chat (uses your last subject)"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                      {sessions.map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (editingSidebarId !== s.id) void handleSelectSession(s);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setEditingSidebarId(s.id);
                            setSidebarEditValue(s.title);
                          }}
                          className={`w-full p-4 rounded-2xl transition-all text-left group cursor-pointer ${activeSession?.id === s.id ? 'bg-rose-500/10 border-rose-500/30 shadow-lg shadow-rose-500/5' : 'bg-background/40 border border-border/50 hover:border-rose-500/30'}`}
                          role="button"
                          tabIndex={0}
                        >
                          {editingSidebarId === s.id ? (
                            <input
                              autoFocus
                              value={sidebarEditValue}
                              onChange={(e) => setSidebarEditValue(e.target.value)}
                              onBlur={async () => {
                                if (sidebarEditValue.trim() && sidebarEditValue !== s.title) {
                                  await handleUpdateTitle(s.id, sidebarEditValue);
                                }
                                setEditingSidebarId(null);
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  if (sidebarEditValue.trim() && sidebarEditValue !== s.title) {
                                    await handleUpdateTitle(s.id, sidebarEditValue);
                                  }
                                  setEditingSidebarId(null);
                                }
                                if (e.key === 'Escape') setEditingSidebarId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-slate-200/50 dark:bg-white/10 border border-rose-500/50 rounded px-2 py-0.5 text-xs text-foreground dark:text-white w-full focus:outline-none"
                            />
                          ) : (
                            <div className="flex items-start gap-2 justify-between">
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-semibold truncate ${activeSession?.id === s.id ? 'text-rose-500' : 'text-muted-foreground group-hover:text-foreground'}`}>{s.title}</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(s.updatedAt || s.createdAt).toLocaleDateString()}</p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteSession(s);
                                }}
                                className="p-1.5 rounded-lg text-muted-foreground/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title={`Delete ${s.title}`}
                                aria-label={`Delete ${s.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.aside>
                </>
              )}
            </AnimatePresence>

            {/* Chat Viewport */}
            {activeSession && (
              <section className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
                {/* Subject pill bar — click = new thread for that subject */}
                <SubjectPillBar
                  activeSubject={activeSession.subject ?? null}
                  onPick={(subjectKey) => {
                    void createNewSession(`${SUBJECT_DISPLAY[subjectKey]} Doubt Session`, subjectKey);
                  }}
                />
                {/* Scrollable Message Area */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 custom-scrollbar">
                  <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
                    {activeSession.messages.map((msg, i) => (
                      <ChatMessage key={msg.id || i} message={msg} />
                    ))}
                    {isTyping && <TypingIndicator />}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                </div>

                {/* Fixed Bottom Input Bar */}
                <div className="p-4 border-t border-blue-500/10 dark:border-slate-800 bg-background/95 dark:bg-slate-900/90 backdrop-blur-xl">
                  <div className="max-w-4xl mx-auto">
                    {/* Status indicators */}
                    <AnimatePresence>
                      {(isRecording || isProcessingImage) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: 10, height: 0 }}
                          className="mb-2 px-4 py-2 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm flex items-center gap-3"
                        >
                          {isRecording && (
                            <>
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                              <span className="text-xs text-red-400 font-medium truncate">
                                {liveTranscript ? liveTranscript : 'Listening... speak now'}
                              </span>
                            </>
                          )}
                          {isProcessingImage && (
                            <>
                              <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                              <span className="text-xs text-rose-400 font-medium">Analyzing image &amp; searching knowledge base...</span>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {highlightedText ? (
                      <div className="mb-2 flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-600/5 px-3 py-2 text-xs">
                        <span className="shrink-0 font-black tracking-wider text-rose-600 dark:text-rose-200">Selected</span>
                        <FormattedMessage content={highlightedText} inline className="line-clamp-1 flex-1 font-medium text-foreground/80" />
                        <button
                          type="button"
                          onClick={() => clearHighlightedText()}
                          className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label="Clear highlighted text"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                    <div className={`bg-card/80 backdrop-blur-2xl border ${isRecording ? 'border-red-500/40 shadow-red-500/10' : 'border-primary/20 dark:border-border/60 shadow-2xl'} rounded-xl sm:rounded-[28px] p-1 sm:p-2 flex items-end gap-1 sm:gap-2 transition-all`}>
                      {!isRecording ? (
                        <>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-slate-400 hover:text-blue-400 transition-colors"
                            title="Upload image of a problem"
                          >
                            <ImagePlus className="w-5 h-5" />
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !activeSession) return;
                              e.target.value = '';
                              await handleImageFileUpload(file, activeSession);
                            }}
                          />
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    if (isRecording) {
                                      speechRecognitionRef.current?.stop();
                                      return;
                                    }

                                    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                                    if (!SpeechRecognition) {
                                      toast.error('Speech recognition is not supported in this browser. Please use Chrome.');
                                      return;
                                    }

                                    const recognition = new SpeechRecognition();
                                    speechRecognitionRef.current = recognition;
                                    recognition.continuous = true;
                                    recognition.interimResults = true;
                                    recognition.lang = 'en-IN';

                                    let finalText = '';

                                    recognition.onresult = (event: any) => {
                                      let interim = '';
                                      for (let i = event.resultIndex; i < event.results.length; i++) {
                                        const result = event.results[i];
                                        if (result.isFinal) {
                                          finalText += result[0].transcript + ' ';
                                        } else {
                                          interim = result[0].transcript;
                                        }
                                      }
                                      setLiveTranscript((finalText + interim).trim());
                                    };

                                    recognition.onend = () => {
                                      setIsRecording(false);
                                      const transcript = finalText.trim();
                                      setLiveTranscript('');
                                      if (transcript) {
                                        setMessage(transcript);
                                        // Use a microtask so setMessage flushes before send
                                        setTimeout(() => {
                                          handleSendMessage(transcript);
                                        }, 0);
                                      }
                                    };

                                    recognition.onerror = (event: any) => {
                                      if (event.error !== 'aborted') {
                                        toast.error('Voice recognition error. Please try again.');
                                      }
                                      setIsRecording(false);
                                      setLiveTranscript('');
                                    };

                                    recognition.start();
                                    setIsRecording(true);
                                    setLiveTranscript('');
                                  }}
                                  className={`p-3 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-400'}`}
                                  title={isRecording ? 'Stop recording' : 'Record voice'}
                                >
                                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-slate-900 border-white/20 text-white shadow-2xl">
                                <div className="p-1">
                                  <p className="text-xs font-bold">{isRecording ? 'Recording...' : 'Unlimited Voice'}</p>
                                  <p className="text-[10px] text-white/60">Voice interaction is unlimited in AI Explainer</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <textarea
                                  rows={1}
                                  value={message}
                                  disabled={isTextQuotaReached}
                                  onChange={(e) => setMessage(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      if (isTextQuotaReached) {
                                        toast.error("Text quota reached for today.");
                                        return;
                                      }
                                      handleSendMessage();
                                    }
                                  }}
                                  placeholder={isTextQuotaReached ? 'Text quota reached for today' : (highlightedText ? 'Ask about the selected text...' : 'Type your question here...')}
                                  className={`flex-1 bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60 py-3 text-[15px] resize-none max-h-40 ${isTextQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-slate-900 border-white/10 text-white">
                                <div className="space-y-1.5 p-1">
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Remaining Text</span>
                                    <span className="text-[10px] font-bold text-emerald-400">{Math.max(0, Math.round(100 - textProgress))}%</span>
                                  </div>
                                  <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${textProgress}%` }} />
                                  </div>
                                  <p className="text-[10px] text-white/40">{getRemainingTokens()}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center gap-3 px-4 py-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                          <span className="flex-1 text-sm text-foreground/80 italic truncate">
                            {liveTranscript || 'Listening...'}
                          </span>
                          <button
                            onClick={() => {
                              speechRecognitionRef.current?.abort();
                              setIsRecording(false);
                              setLiveTranscript('');
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (isRecording) {
                            speechRecognitionRef.current?.stop();
                          } else {
                            handleSendMessage();
                          }
                        }}
                        disabled={!isRecording && !message.trim() && !highlightedText}
                        className={`p-3 rounded-2xl transition-all ${isRecording
                          ? 'bg-red-500 text-white shadow-lg shadow-red-600/30'
                          : ((message.trim() || highlightedText) ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-muted/20 text-muted-foreground/40 cursor-not-allowed')}`}
                      >
                        {isRecording ? <div className="w-5 h-5 flex items-center justify-center font-bold">●</div> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <img src="/O3-Origin-Logo.png" alt="O3 Origin" className="h-4 w-auto grayscale opacity-50" />
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                        AI Mentor • Powered by O3 Origin
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {showImageUpload && (
        <ImageUploadModal
          onClose={() => setShowImageUpload(false)}
          onUpload={(file) => { void handleImageFileUpload(file); }}
        />
      )}
    </div >
  );
}

function SelectionView({ onCreate, onUpload, sessions, onSelectSession, lastSession, onUpdateTitle, onStartNewChat, onDeleteSession, onGeneralChat }: {
  onCreate: (t: string, sub: SubjectKey) => void,
  onUpload: () => void,
  sessions: DoubtSession[],
  onSelectSession: (s: DoubtSession) => void,
  lastSession?: DoubtSession,
  onUpdateTitle: (id: string, title: string) => Promise<void>,
  onStartNewChat: () => void,
  onDeleteSession: (session: DoubtSession) => Promise<void>,
  onGeneralChat?: () => void,
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const quickTopics: { name: string; subjectKey: SubjectKey | 'general'; icon: typeof Atom; color: string; desc: string }[] = [
    { name: 'Physics', subjectKey: 'phy', icon: Atom, color: 'text-blue-400', desc: 'Chapters & Concepts' },
    { name: 'Chemistry', subjectKey: 'chem', icon: FlaskConical, color: 'text-emerald-400', desc: 'Chapters & Concepts' },
    { name: 'Mathematics', subjectKey: 'math', icon: Calculator, color: 'text-violet-400', desc: 'Chapters & Concepts' },
    { name: 'Biology', subjectKey: 'bio', icon: Leaf, color: 'text-green-400', desc: 'Chapters & Concepts' },
    { name: 'General', subjectKey: 'general', icon: MessageCircle, color: 'text-amber-400', desc: 'Ask Anything' },
  ];

  const handleStartEdit = (e: React.MouseEvent<HTMLElement>, s: DoubtSession) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditValue(s.title);
  };

  const handleFinishEdit = async () => {
    if (editingId && editValue.trim()) {
      await onUpdateTitle(editingId, editValue);
    }
    setEditingId(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-12 overflow-y-auto custom-scrollbar">
      <div className="relative p-5 sm:p-10 rounded-[24px] sm:rounded-[40px] bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border border-muted dark:border-slate-800 mb-6 sm:mb-12 overflow-hidden group shadow-xl">
        <Sparkles className="absolute top-4 sm:top-6 right-6 sm:right-8 w-6 h-6 sm:w-12 sm:h-12 text-blue-500/10 group-hover:rotate-12 transition-transform duration-700" />
        <h2 className="text-xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4 leading-tight">Master your subjects<br />with AI precision.</h2>
        <p className="text-muted-foreground text-xs sm:text-lg max-w-xl mb-4 sm:mb-8 leading-relaxed">Stuck on a problem at 2 AM? Get step-by-step guidance and conceptual deep-dives instantly.</p>
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <button
            id="tutorial-doubt-solver-new"
            onClick={onStartNewChat}
            className="px-5 sm:px-8 py-2.5 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg sm:rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2 text-xs sm:text-base"
          >
            <Plus className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> Start New Chat
          </button>
          {lastSession && (
            <button
              onClick={() => onSelectSession(lastSession)}
              className="px-5 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-500 rounded-lg sm:rounded-2xl font-bold transition-all flex items-center gap-2 text-xs sm:text-base"
            >
              Continue last chat
            </button>
          )}
          <button onClick={onUpload} className="px-5 sm:px-8 py-2.5 sm:py-4 bg-muted hover:bg-muted/80 border border-border/60 text-foreground rounded-lg sm:rounded-2xl font-bold transition-all flex items-center gap-2 shadow-sm text-xs sm:text-base">
            <ImagePlus className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> Scan Problem
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h3 className="text-xl font-bold text-foreground dark:text-white mb-6 uppercase tracking-widest text-blue-400/80">Subjects</h3>
          <div className="grid grid-cols-1 gap-4">
            {quickTopics.map((topic) => (
              <button
                key={topic.name}
                onClick={() => {
                  if (topic.subjectKey === 'general') {
                    onGeneralChat?.();
                  } else {
                    onCreate(`${topic.name} Doubt Session`, topic.subjectKey as SubjectKey);
                  }
                }}
                className="p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] bg-card/40 border border-muted hover:border-blue-500/30 dark:border-slate-800 transition-all group flex items-center gap-4 sm:gap-6 shadow-sm hover:shadow-md"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-muted border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <topic.icon className={`w-5 h-5 sm:w-7 sm:h-7 ${topic.color}`} />
                </div>
                <div>
                  <p className="text-base sm:text-lg font-bold text-foreground mb-0.5">{topic.name}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{topic.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6 uppercase tracking-widest opacity-50">History</h3>
          <div className="space-y-3 lg:max-h-[34rem] lg:overflow-y-auto lg:pr-1 lg:custom-scrollbar">
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleStartEdit(e, s);
                }}
                className="w-full p-4 sm:p-5 rounded-2xl sm:rounded-[28px] bg-card/30 border border-muted hover:bg-card/50 dark:border-slate-800 transition-all text-left flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-4 flex-1 mr-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                    <Atom className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {editingId === s.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-slate-200/50 dark:bg-white/10 border border-blue-500/50 rounded px-2 py-0.5 text-sm text-foreground dark:text-white w-full focus:outline-none"
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2 group/title">
                          <p className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors truncate">{s.title}</p>
                          <span
                            onClick={(e) => handleStartEdit(e, s)}
                            className="opacity-0 group-hover/title:opacity-100 p-1 rounded hover:bg-muted transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-blue-500" />
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.updatedAt || s.createdAt).toLocaleDateString()}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDeleteSession(s);
                    }}
                    className="p-2 rounded-full text-muted-foreground/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title={`Delete ${s.title}`}
                    aria-label={`Delete ${s.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="p-10 text-center rounded-[28px] border border-dashed border-white/5">
                <p className="text-sm text-slate-500">No previous sessions found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function ProgressiveResponse({
  content,
  progressive = false,
}: {
  content: string;
  progressive?: boolean;
}) {
  const steps = extractResponseSteps(content);
  const [revealedCount, setRevealedCount] = useState(1);
  const isMultiStep = steps.length > 1;

  if (!isMultiStep) {
    return <FormattedMessage content={steps[0] ?? content} isAssistant={true} />;
  }

  if (!progressive) {
    return (
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div
            key={`${i}-${step.slice(0, 24)}`}
            className={i > 0 ? "pt-4 border-t border-white/5" : ""}
          >
            <FormattedMessage content={step} isAssistant={true} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.slice(0, revealedCount).map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={i > 0 ? "pt-4 border-t border-white/5" : ""}
        >
          <FormattedMessage content={step.trim()} isAssistant={true} />
        </motion.div>
      ))}

      {revealedCount < steps.length && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setRevealedCount(prev => prev + 1)}
          className="mt-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-400 text-xs font-bold transition-all flex items-center gap-2 group"
        >
          {revealedCount === 1 ? 'Get Hint' : `Reveal Step ${revealedCount}`}
          <Sparkles className="w-3 h-3 group-hover:rotate-12 transition-transform" />
        </motion.button>
      )}
    </div>
  );
}

function ChatMessage({ message }: { message: ChatMessageType }) {
  const isAI = message.role === 'assistant';
  const progressiveReveal = isAI && shouldUseProgressiveReveal(message);
  return (
    <div className={`flex w-full ${isAI ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <div className={`flex gap-4 max-w-[85%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
        {isAI && (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-blue-900/20 overflow-hidden">
            <img src="/ai-bot.png" alt="AI" className="w-full h-full object-cover" />
          </div>
        )}
        <div className={`p-3 sm:p-5 rounded-xl sm:rounded-[28px] text-xs sm:text-[15px] leading-relaxed shadow-xl relative ${isAI
          ? 'bg-card/60 backdrop-blur-md border border-border/60 text-foreground rounded-tl-none'
          : 'bg-blue-600 text-white border border-blue-400/30 rounded-tr-none shadow-blue-600/20'
          }`}>
          {isAI && !!message.metadata?.retrieval_status && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 w-fit border ${
              message.metadata.retrieval_status === 'retrieved from kb'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}>
              {message.metadata.retrieval_status === 'retrieved from kb' ? (
                <>
                  <Database className="w-3 h-3" />
                  retrieved from kb
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  generated
                </>
              )}
            </div>
          )}
          {message.image && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 max-w-[200px]">
              <img src={message.image} alt="Uploaded problem" className="w-full h-auto object-cover" />
            </div>
          )}
          <div>
            <FormattedMessage content={message.content} isAssistant={isAI} />
          </div>
          <div className={`text-[10px] mt-3 font-bold uppercase tracking-widest opacity-40 ${isAI ? 'text-slate-400' : 'text-blue-100'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectPillBar({
  activeSubject,
  onPick,
}: {
  activeSubject: string | null;
  onPick: (subject: SubjectKey) => void;
}) {
  const pills: { key: SubjectKey; name: string; icon: typeof Atom; color: string; activeBg: string }[] = [
    { key: 'phy',  name: 'Physics',     icon: Atom,         color: 'text-blue-400',    activeBg: 'bg-blue-500/15 border-blue-500/40' },
    { key: 'chem', name: 'Chemistry',   icon: FlaskConical, color: 'text-emerald-400', activeBg: 'bg-emerald-500/15 border-emerald-500/40' },
    { key: 'math', name: 'Mathematics', icon: Calculator,   color: 'text-violet-400',  activeBg: 'bg-violet-500/15 border-violet-500/40' },
    { key: 'bio',  name: 'Biology',     icon: Leaf,         color: 'text-green-400',   activeBg: 'bg-green-500/15 border-green-500/40' },
  ];
  const normalized = (activeSubject ?? '').toLowerCase();
  return (
    <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-border/30 bg-card/30 backdrop-blur-sm flex-shrink-0">
      <div className="max-w-4xl mx-auto flex flex-wrap gap-2">
        {pills.map((pill) => {
          const isActive = normalized === pill.key || normalized === pill.name.toLowerCase();
          const Icon = pill.icon;
          return (
            <button
              key={pill.key}
              onClick={() => onPick(pill.key)}
              title={`Start a new ${pill.name} thread`}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all',
                isActive
                  ? `${pill.activeBg} ${pill.color}`
                  : 'border-border/50 text-muted-foreground hover:border-blue-500/30 hover:text-foreground',
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? pill.color : 'opacity-70')} />
              {pill.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChapterSelectionView({
  subject,
  chapters,
  loading,
  onSelectChapter,
  onBack,
}: {
  subject: SubjectKey;
  chapters: ChapterItem[];
  loading: boolean;
  onSelectChapter: (chapter: ChapterItem) => void;
  onBack: () => void;
}) {
  const subjectName = SUBJECT_DISPLAY[subject];
  const subjectColors: Record<SubjectKey, { accent: string; bg: string; border: string; badge: string }> = {
    phy: { accent: 'text-blue-400', bg: 'from-blue-600/10 to-blue-800/5', border: 'border-blue-500/20 hover:border-blue-500/40', badge: 'bg-blue-500/15 text-blue-400' },
    chem: { accent: 'text-emerald-400', bg: 'from-emerald-600/10 to-emerald-800/5', border: 'border-emerald-500/20 hover:border-emerald-500/40', badge: 'bg-emerald-500/15 text-emerald-400' },
    math: { accent: 'text-violet-400', bg: 'from-violet-600/10 to-violet-800/5', border: 'border-violet-500/20 hover:border-violet-500/40', badge: 'bg-violet-500/15 text-violet-400' },
    bio: { accent: 'text-green-400', bg: 'from-green-600/10 to-green-800/5', border: 'border-green-500/20 hover:border-green-500/40', badge: 'bg-green-500/15 text-green-400' },
  };
  const colors = subjectColors[subject];

  const class11Chapters = chapters.filter(ch => ch.ncertClass === '11');
  const class12Chapters = chapters.filter(ch => ch.ncertClass === '12');

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading chapters...</p>
        </div>
      </div>
    );
  }

  const renderChapterCard = (chapter: ChapterItem) => (
    <motion.button
      key={chapter.name}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelectChapter(chapter)}
      className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${colors.bg} border ${colors.border} transition-all text-left group shadow-sm hover:shadow-lg`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-bold text-foreground group-hover:text-foreground/90 leading-snug">{chapter.name}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">{chapter.conceptCount} concepts</p>
        </div>
        <Sparkles className={`w-4 h-4 ${colors.accent} opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5`} />
      </div>
    </motion.button>
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className={`relative p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] bg-gradient-to-br ${colors.bg} border border-border/60 mb-6 sm:mb-8 overflow-hidden shadow-lg`}>
        <Sparkles className={`absolute top-4 right-6 w-8 h-8 ${colors.accent} opacity-10`} />
        <h2 className={`text-xl sm:text-3xl font-bold text-foreground mb-2 leading-tight`}>
          {subjectName} Chapters
        </h2>
        <p className="text-muted-foreground text-xs sm:text-base max-w-xl leading-relaxed">
          Select a chapter to get a detailed AI-powered explanation of all concepts.
        </p>
      </div>

      {/* Class 11 */}
      {class11Chapters.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4 px-1">
            <span className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest ${colors.badge}`}>
              Class 11
            </span>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {class11Chapters.map(renderChapterCard)}
          </div>
        </div>
      )}

      {/* Class 12 */}
      {class12Chapters.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4 px-1">
            <span className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest ${colors.badge}`}>
              Class 12
            </span>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {class12Chapters.map(renderChapterCard)}
          </div>
        </div>
      )}

      {chapters.length === 0 && !loading && (
        <div className="p-10 text-center rounded-[28px] border border-dashed border-border/30">
          <p className="text-sm text-muted-foreground">No chapters found for {subjectName}.</p>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-4">
      <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center overflow-hidden">
        <img src="/ai-bot.png" alt="AI Thinking" className="w-full h-full object-cover animate-pulse" />
      </div>
      <div className="px-6 py-4 bg-white/[0.04] border border-white/5 rounded-[28px] rounded-tl-none flex gap-1.5 items-center">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
      </div>
    </div>
  );
}


function ImageUploadModal({ onClose, onUpload }: { onClose: () => void, onUpload: (file: File) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border/40 rounded-[32px] p-8 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-foreground dark:text-white">Visual Problem Solver</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-3xl p-12 text-center group hover:border-blue-500/50 transition-all cursor-pointer bg-white/[0.02]"
        >
          <div className="w-12 h-12 text-blue-500 mx-auto mb-6 group-hover:scale-110 transition-transform flex items-center justify-center">📷</div>
          <p className="text-lg font-semibold text-foreground dark:text-white mb-2">Snap or Drag Problem</p>
          <p className="text-sm text-slate-500">Supports handwriting and textbook scans</p>
        </div>
      </div>
    </div>
  );
}
