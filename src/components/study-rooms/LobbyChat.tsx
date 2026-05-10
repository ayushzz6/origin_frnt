'use client';

import { useState } from 'react';
import { SendHorizonal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RoomMessage } from '@/lib/study-rooms/events';

export function LobbyChat({
  messages,
  locked,
  currentUserId,
  onSend,
}: {
  messages: RoomMessage[];
  locked: boolean;
  currentUserId: string;
  onSend: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submit = async (): Promise<void> => {
    if (!content.trim()) return;
    setIsSending(true);
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
    <section className="flex min-h-[420px] flex-col rounded-lg border border-primary/20 bg-card/40 backdrop-blur-md shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Lobby Chat</h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[180px] items-center justify-center text-sm font-medium text-slate-400">
            No messages yet
          </div>
        ) : messages.map((message) => {
          const isMine = message.user_id === currentUserId;
          return (
            <div key={message.id} className={isMine ? 'flex justify-end' : 'flex justify-start'}>
              <div className={isMine 
                ? 'max-w-[80%] rounded-lg bg-primary/40 backdrop-blur-md px-3 py-2 text-foreground border border-primary/20 shadow-sm' 
                : 'max-w-[80%] rounded-lg bg-slate-100/50 backdrop-blur-md px-3 py-2 border border-slate-200/50 dark:bg-slate-900/50 dark:border-slate-800/50'
              }>
                {!isMine && <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{message.display_name}</p>}
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
              </div>
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="flex gap-2">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              rows={2}
              maxLength={1000}
              placeholder="Message the room"
              className="resize-none"
            />
            <Button size="icon" className="h-auto w-11" onClick={submit} disabled={isSending || !content.trim()}>
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
