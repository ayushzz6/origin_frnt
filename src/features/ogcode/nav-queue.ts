/**
 * ogcode nav-queue — a tiny sessionStorage bridge so the question workspace
 * (/ogcode/[id]) can offer Previous / Next navigation that follows whatever
 * filter the user had applied on the list (/ogcode).
 *
 * The list writes the ordered, currently-filtered question IDs here; the
 * workspace reads them to find the current question's neighbours. It degrades
 * gracefully — if nothing was stored (e.g. the user opened a question link
 * directly) the workspace simply hides the nav buttons.
 */
const KEY = 'ogcode:nav-queue';

export interface OgcodeNavQueue {
  /** Ordered question IDs as currently filtered on the list. */
  ids: string[];
  /** Human-readable summary of the active filter (e.g. "Physics · Hard"). */
  label?: string | null;
  /**
   * URL search-param string that was active when the queue was built
   * (e.g. "subject=phy&difficulty=easy"). Used by the workspace to:
   * 1. Fetch more questions with the same filter on "Load More"
   * 2. Return to the list with filters intact via the back button
   */
  filterParams?: string | null;
}

export function saveOgcodeNavQueue(queue: OgcodeNavQueue): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* storage unavailable / quota — nav just won't be available */
  }
}

export function readOgcodeNavQueue(): OgcodeNavQueue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OgcodeNavQueue;
    if (parsed && Array.isArray(parsed.ids)) {
      return { ids: parsed.ids.map(String), label: parsed.label ?? null, filterParams: parsed.filterParams ?? null };
    }
  } catch {
    /* ignore malformed payloads */
  }
  return null;
}

/** Resolve the previous/next question IDs relative to `currentId` within a queue. */
export function getOgcodeNeighbours(
  queue: OgcodeNavQueue | null,
  currentId: string,
): { prevId: string | null; nextId: string | null; index: number; total: number } {
  if (!queue || queue.ids.length === 0) {
    return { prevId: null, nextId: null, index: -1, total: 0 };
  }
  const index = queue.ids.indexOf(String(currentId));
  if (index === -1) {
    return { prevId: null, nextId: null, index: -1, total: queue.ids.length };
  }
  return {
    prevId: index > 0 ? queue.ids[index - 1] : null,
    nextId: index < queue.ids.length - 1 ? queue.ids[index + 1] : null,
    index,
    total: queue.ids.length,
  };
}
