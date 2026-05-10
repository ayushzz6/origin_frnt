import { useEffect, useMemo, useState } from "react";

export type ServerAnchoredTimerSource = {
  startedAt: string;
  durationSeconds: number;
  skewMs?: number;
};

function computeRemainingSeconds(source: ServerAnchoredTimerSource): number {
  const startedAtMs = new Date(source.startedAt).getTime();
  const correctedNowMs = Date.now() - (source.skewMs ?? 0);
  const remainingMs = source.durationSeconds * 1000 - (correctedNowMs - startedAtMs);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function useServerAnchoredTimer(source: ServerAnchoredTimerSource | undefined, active: boolean) {
  const initial = useMemo(() => (source ? computeRemainingSeconds(source) : 0), [source]);
  const [remainingSeconds, setRemainingSeconds] = useState(initial);

  useEffect(() => {
    if (!source || !active) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds(computeRemainingSeconds(source));
    }, 250);
    return () => window.clearInterval(interval);
  }, [active, source]);

  return remainingSeconds;
}
