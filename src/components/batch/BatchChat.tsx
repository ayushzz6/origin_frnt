"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiJson } from "@/lib/teacher-client";
import type { BatchMessage } from "@/server/workspaces/batch-messages-store";
import { toast } from "sonner";

type Props = {
  /** GET (list) + POST (send) endpoint. */
  messagesUrl: string;
  /** Used to right-align the current user's own messages. */
  currentUserId?: string | null;
  /** Fallback alignment when currentUserId is unknown. */
  mineRole?: "teacher" | "student";
  /** Poll interval (ms). */
  pollMs?: number;
};

const LINK_RE = /(https?:\/\/[^\s]+)/g;

function renderBody(text: string) {
  // Split on URLs and render them as safe, clickable anchors (text is escaped
  // by React; we never dangerouslySetInnerHTML).
  const parts = text.split(LINK_RE);
  return parts.map((part, i) =>
    LINK_RE.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-80">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function BatchChat({ messagesUrl, currentUserId, mineRole, pollMs = 8000 }: Props) {
  const [messages, setMessages] = useState<BatchMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const result = await apiJson<{ messages: BatchMessage[] }>(messagesUrl, { method: "GET" });
    if (result.ok) setMessages(result.data.messages);
    setLoading(false);
  }, [messagesUrl]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), pollMs);
    return () => clearInterval(interval);
  }, [load, pollMs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    void (async () => {
      const result = await apiJson<{ message: BatchMessage }>(messagesUrl, { method: "POST", json: { body } });
      if (result.ok) {
        setDraft("");
        setMessages((prev) => [...prev, result.data.message]);
      } else {
        toast.error(result.detail || "Failed to send message");
      }
      setSending(false);
    })();
  }

  const isMine = (m: BatchMessage) =>
    currentUserId ? m.senderId === currentUserId : mineRole ? m.senderRole === mineRole : false;

  return (
    <div className="flex flex-col border rounded-2xl bg-card overflow-hidden h-[60vh]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-muted/5">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            No messages yet. Say hello to the batch 👋
          </div>
        ) : (
          messages.map((m) => {
            const mine = isMine(m);
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-primary text-black" : "bg-muted border"
                }`}>
                  {!mine && (
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-0.5">
                      {m.senderName || (m.senderRole === "teacher" ? "Teacher" : "Student")}
                      {m.senderRole === "teacher" && " · teacher"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{renderBody(m.body)}</p>
                  {m.linkUrl && (
                    <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-xs underline opacity-90">
                      <ExternalLink className="w-3 h-3" /> Open link
                    </a>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-3 flex gap-2 shrink-0">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the batch… (links become clickable)"
          className="h-10 rounded-xl"
        />
        <Button onClick={send} disabled={sending || !draft.trim()} className="h-10 rounded-xl gap-1.5 shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
        </Button>
      </div>
    </div>
  );
}
