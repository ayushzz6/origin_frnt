'use client';

import { useEffect, useRef, useState } from 'react';
import { SendHorizonal, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { ChatBackdrop } from '@/components/chat/ChatBackdrop';
import type { PendingMessage } from '@/context/StudyRoomContext';
import type { RoomMessage } from '@/lib/study-rooms/events';

function typingLabel(typingUsers: { user_id: string; display_name: string }[]): string {
  const names = typingUsers.map((user) => user.display_name || 'Someone');
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]} and ${names.length - 1} others are typing…`;
}

// Deterministic colour per user so each participant keeps a consistent avatar.
const AVATAR_COLORS = [
  'bg-rose-500/20 text-rose-600 dark:text-rose-300',
  'bg-amber-500/20 text-amber-600 dark:text-amber-300',
  'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
  'bg-sky-500/20 text-sky-600 dark:text-sky-300',
  'bg-violet-500/20 text-violet-600 dark:text-violet-300',
  'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300',
  'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300',
  'bg-orange-500/20 text-orange-600 dark:text-orange-300',
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function MessageAvatar({ name, userId }: { name: string; userId: string }) {
  const initials = (name?.trim() || '?').slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        'h-8 w-8 flex-shrink-0 self-end rounded-full flex items-center justify-center text-[11px] font-black select-none',
        avatarColor(userId),
      )}
      title={name}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function LobbyChat({
  messages,
  locked,
  currentUserId,
  onSend,
  pendingMessages = [],
  typingUsers = [],
  onTyping,
}: {
  messages: RoomMessage[];
  locked: boolean;
  currentUserId: string;
  onSend: (content: string) => Promise<void>;
  pendingMessages?: PendingMessage[];
  typingUsers?: { user_id: string; display_name: string }[];
  onTyping?: (isTyping: boolean) => void;
}) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // My display name, inferred from my own confirmed messages (used for the
  // avatar on optimistic/pending messages where no name is attached yet).
  const myName = messages.find((m) => m.user_id === currentUserId)?.display_name ?? 'You';

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, pendingMessages.length, typingUsers.length]);

  const submit = async (): Promise<void> => {
    if (!content.trim()) return;
    setIsSending(true);
    onTyping?.(false);
    try {
      await onSend(content);
      setContent('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="neu-raised rounded-2xl flex flex-col min-h-[420px] overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/40 px-5 py-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Lobby Chat</h2>
      </div>

      {/* Messages — WhatsApp-inspired chat canvas, recoloured for Origin */}
      <div ref={scrollRef} className="chat-canvas relative flex-1 overflow-y-auto px-4 py-4">
        <ChatBackdrop />

        <div className="relative z-10 space-y-3">
        {messages.length === 0 && pendingMessages.length === 0 ? (
          <div className="flex h-full min-h-[180px] items-center justify-center text-sm font-medium text-muted-foreground">
            No messages yet — say hi!
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isMine = message.user_id === currentUserId;
              return (
                <div key={message.id} className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
                  {!isMine && <MessageAvatar name={message.display_name} userId={message.user_id} />}
                  <div className={cn(
                    'max-w-[76%] px-3.5 py-2.5 shadow-sm',
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-[2px_2px_6px_hsl(var(--neu-shadow))]'
                      : 'bg-card border border-border/60 rounded-2xl rounded-bl-sm'
                  )}>
                    {!isMine && (
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {message.display_name}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                  </div>
                  {isMine && <MessageAvatar name={myName} userId={currentUserId} />}
                </div>
              );
            })}
            {/* Optimistic messages — shown instantly, dimmed until confirmed. */}
            {pendingMessages.map((message) => (
              <div key={message.tempId} className="flex items-end justify-end gap-2">
                <div className="max-w-[76%] bg-primary/40 opacity-60 rounded-2xl rounded-br-sm px-3.5 py-2.5 text-foreground shadow-sm">
                  <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                </div>
                <MessageAvatar name={myName} userId={currentUserId} />
              </div>
            ))}
          </>
        )}
        </div>
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-5 pb-1 text-xs italic text-muted-foreground" aria-live="polite">
          {typingLabel(typingUsers)}
        </div>
      )}

      {/* Input */}
      {!locked && (
        <div className="border-t border-border/40 p-4">
          <div className="neu-inset rounded-xl flex gap-2 p-2">
            <textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                onTyping?.(event.target.value.trim().length > 0);
              }}
              onBlur={() => onTyping?.(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              rows={2}
              maxLength={1000}
              placeholder="Message the room…"
              className="flex-1 bg-transparent outline-none text-sm px-2 py-1 resize-none placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={submit}
              disabled={isSending || !content.trim()}
              className="self-end h-9 w-9 flex-shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
