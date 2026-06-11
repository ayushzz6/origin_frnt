'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2, Mic, MicOff, Send, MessageSquare } from 'lucide-react';

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
  readonly length: number;
}
interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
  readonly length: number;
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const TEXT_LIMIT = 5;
const VOICE_LIMIT = 3;

function getWeekKey() {
  const d = new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `origin-demo-${d.getFullYear()}-W${week}`;
}

interface Usage { text: number; voice: number }

function getUsage(): Usage {
  if (typeof window === 'undefined') return { text: 0, voice: 0 };
  try {
    const stored = localStorage.getItem(getWeekKey());
    return stored ? (JSON.parse(stored) as Usage) : { text: 0, voice: 0 };
  } catch { return { text: 0, voice: 0 }; }
}

function saveUsage(usage: Usage) {
  try { localStorage.setItem(getWeekKey(), JSON.stringify(usage)); } catch {}
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  isVoice?: boolean;
  isLimitMsg?: boolean;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^(\d+)\.\s/gm, '<span class="text-primary font-black mr-1">$1.</span> ');
}

// Shows the full AI answer — no blur until quota is gone
function AiResponse({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="text-sm text-gray-700 dark:text-white/80 leading-relaxed space-y-3 font-medium">
      {paras.map((p, i) => (
        <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(p) }} />
      ))}
    </div>
  );
}

// Special inline card that appears after quota is exhausted
function LimitCard() {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-white/70">
        You&apos;ve used your free preview quota for this week.
      </p>
      <p className="text-xs text-gray-500 dark:text-white/40">
        Sign up free to ask unlimited questions, use voice anytime, and unlock the full Origin AI inside.
      </p>
      <motion.a
        href="/auth/register"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/30"
      >
        Unlock Free Access <ArrowRight className="w-3.5 h-3.5" />
      </motion.a>
    </div>
  );
}

export default function TryOriginAI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      content:
        "Hi! I'm Origin AI — your JEE & NEET mentor. Ask me any question from Physics, Chemistry, Maths, or Biology and I'll solve it step by step.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<Usage>({ text: 0, voice: 0 });
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef('');
  const didMountRef = useRef(false);

  useEffect(() => {
    setUsage(getUsage());
  }, []);

  useEffect(() => {
    // Skip the initial mount so loading the page never auto-scrolls to this section.
    // Only scroll the chat's OWN container — never the page.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const c = messagesContainerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages, loading]);

  function appendLimitCard() {
    setMessages(prev => [
      ...prev,
      { id: `limit-${Date.now()}`, role: 'ai', content: '', isLimitMsg: true },
    ]);
  }

  async function sendMessage(question: string, isVoice = false) {
    const q = question.trim();
    if (!q || loading) return;

    const currentUsage = getUsage();
    const textExhausted = !isVoice && currentUsage.text >= TEXT_LIMIT;
    const voiceExhausted = isVoice && currentUsage.voice >= VOICE_LIMIT;

    if (textExhausted || voiceExhausted) {
      // Show the user's message then the limit card
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: q, isVoice },
        { id: `limit-${Date.now() + 1}`, role: 'ai', content: '', isLimitMsg: true },
      ]);
      setInput('');
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q, isVoice };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const newUsage: Usage = {
      text: isVoice ? currentUsage.text : currentUsage.text + 1,
      voice: isVoice ? currentUsage.voice + 1 : currentUsage.voice,
    };
    saveUsage(newUsage);
    setUsage(newUsage);

    try {
      const res = await fetch('/api/public/demo-solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, hp: '' }),
      });
      const data = await res.json() as { answer?: string; error?: string };

      if (res.status === 429) {
        // Server-side limit hit — surface the limit card
        setMessages(prev => [
          ...prev,
          { id: `limit-${Date.now()}`, role: 'ai', content: '', isLimitMsg: true },
        ]);
      } else {
        const answer = res.ok ? (data.answer ?? "Sorry, I couldn't generate a response.") : (data.error ?? 'Something went wrong. Please try again.');
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: 'ai', content: answer },
        ]);

        // If this was the last allowed message, immediately follow with the limit card
        const afterUsage = newUsage;
        if (afterUsage.text >= TEXT_LIMIT && afterUsage.voice >= VOICE_LIMIT) {
          setTimeout(() => appendLimitCard(), 400);
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'ai', content: 'Network error — please check your connection and try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    const SpeechRecognitionAPI = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setVoiceError('Voice input not supported in your browser. Try Chrome.');
      return;
    }
    const currentUsage = getUsage();
    if (currentUsage.voice >= VOICE_LIMIT) {
      setVoiceError(`Voice trials used up (${VOICE_LIMIT}/week). Sign up to talk with Origin AI anytime!`);
      return;
    }

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionAPI();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    transcriptRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      transcriptRef.current = transcript;
    };

    recognition.onend = () => {
      setIsListening(false);
      const t = transcriptRef.current.trim();
      if (t.length >= 5) {
        sendMessage(t, true);
        setInput('');
        transcriptRef.current = '';
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceError('Could not capture audio. Please try again.');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setVoiceError('');
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  const textLeft = Math.max(0, TEXT_LIMIT - usage.text);
  const voiceLeft = Math.max(0, VOICE_LIMIT - usage.voice);
  const exhausted = textLeft === 0 && voiceLeft === 0;

  return (
    <section id="demo" className="py-24 lg:py-32 relative z-10">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-12"
        >
          <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase block mb-4">
            Live Preview
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none mb-4">
            <span className="text-outline">Talk to</span>{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Origin AI
            </span>{' '}
            <span className="text-outline">now.</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-base font-medium">
            5 text questions + 3 voice trials per week — free, no account needed.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true, margin: '-80px' }}
          className="rounded-2xl border border-black/10 dark:border-white/10 bg-gray-100 dark:bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/30"
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/50" />
              </div>
              <div className="flex items-center gap-1.5 ml-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-600 dark:text-white/50">Origin AI</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider border rounded-full px-2 py-1 transition-colors ${
                  textLeft === 0 ? 'text-red-400/70 border-red-400/20' : 'text-gray-500 dark:text-white/40 border-black/10 dark:border-white/10'
                }`}
              >
                <MessageSquare className="w-3 h-3" /> {textLeft}/{TEXT_LIMIT} text
              </span>
              <span
                className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider border rounded-full px-2 py-1 transition-colors ${
                  voiceLeft === 0 ? 'text-red-400/70 border-red-400/20' : 'text-gray-500 dark:text-white/40 border-black/10 dark:border-white/10'
                }`}
              >
                <Mic className="w-3 h-3" /> {voiceLeft}/{VOICE_LIMIT} voice
              </span>
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="h-[445px] overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && !msg.isLimitMsg && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mr-2 mt-1 shrink-0">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                )}

                {msg.isLimitMsg ? (
                  <div className="w-full">
                    <LimitCard />
                  </div>
                ) : (
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary/20 border border-primary/20 text-gray-900 dark:text-white text-sm font-medium'
                        : 'bg-gray-100 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08]'
                    }`}
                  >
                    {msg.role === 'ai' ? (
                      <AiResponse text={msg.content} />
                    ) : (
                      <p className="text-sm">
                        {msg.content}
                        {msg.isVoice && <span className="ml-2 text-primary text-xs">🎤</span>}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mr-2 mt-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-gray-100 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice error */}
          <AnimatePresence>
            {voiceError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 font-medium"
              >
                {voiceError}{' '}
                <a href="/auth/register" className="underline text-primary font-black">Sign up free →</a>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="border-t border-black/[0.08] dark:border-white/[0.08] p-3">
            <div className="flex items-end gap-2">
              <button
                onClick={isListening ? stopVoice : startVoice}
                disabled={voiceLeft === 0 && !isListening}
                title={
                  voiceLeft === 0
                    ? 'Voice trials used — sign up for unlimited'
                    : isListening
                    ? 'Stop listening'
                    : `Voice mode (${voiceLeft} trial${voiceLeft !== 1 ? 's' : ''} left this week)`
                }
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  isListening
                    ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                    : voiceLeft === 0
                    ? 'bg-gray-100 dark:bg-white/[0.03] border-black/10 dark:border-white/10 text-gray-400 dark:text-white/20 cursor-not-allowed'
                    : 'bg-gray-100 dark:bg-white/[0.06] border-black/10 dark:border-white/10 text-gray-600 dark:text-white/50 hover:text-white hover:border-primary/40 hover:bg-primary/10'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value.slice(0, 500));
                    setVoiceError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder={
                    isListening
                      ? '🎤 Listening…'
                      : exhausted
                      ? 'Sign up for unlimited access — free forever'
                      : 'Ask any JEE / NEET question…'
                  }
                  rows={1}
                  disabled={exhausted}
                  className="w-full resize-none rounded-xl bg-gray-100 dark:bg-white/[0.06] border border-black/[0.1] dark:border-white/[0.1] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-all duration-200 font-medium disabled:opacity-40"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
                <div className="absolute bottom-2 right-3 text-[9px] text-gray-400 dark:text-white/20 font-mono">{input.length}/500</div>
              </div>

              <button
                onClick={() => sendMessage(input)}
                disabled={input.trim().length < 5 || loading || exhausted}
                className="shrink-0 w-10 h-10 rounded-xl bg-primary/90 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary transition-all duration-200"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[9px] text-gray-400 dark:text-white/20 mt-2 text-center">
              {isListening
                ? 'Speak now — Origin AI is listening'
                : 'Enter to send · Shift+Enter for new line · 🎤 for voice input'}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
