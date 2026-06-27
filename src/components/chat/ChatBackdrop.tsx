import { cn } from '@/lib/utils';

/**
 * Faint Ori mascots that drift behind a conversation, paired with the shared
 * `.chat-canvas` doodle wallpaper (defined in globals.css).
 *
 * Drop this as the first child of a `relative` scroll container that also has
 * the `chat-canvas` class, then wrap the actual messages in a `relative z-10`
 * layer so they sit above the decoration.
 */
export function ChatBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden', className)} aria-hidden>
      <img
        src="/ori2d/ori-curious.png"
        alt=""
        draggable={false}
        className="select-none absolute right-4 top-8 w-24 opacity-[0.07]"
      />
      <img
        src="/ori2d/ori-reading.png"
        alt=""
        draggable={false}
        className="select-none absolute left-3 top-1/2 w-20 opacity-[0.06]"
      />
      <img
        src="/ori2d/ori-thinking.png"
        alt=""
        draggable={false}
        className="select-none absolute right-8 bottom-10 w-20 opacity-[0.07]"
      />
    </div>
  );
}
