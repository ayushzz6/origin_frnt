'use client';

import type React from 'react';

import { useServerAnchoredTimer, type ServerAnchoredTimerSource } from '@/hooks/useServerAnchoredTimer';

export function ServerAnchoredTimer({
  source,
  active = true,
  children,
}: {
  source: ServerAnchoredTimerSource;
  active?: boolean;
  children: (remainingSeconds: number) => React.ReactNode;
}) {
  const remainingSeconds = useServerAnchoredTimer(source, active);
  return <>{children(remainingSeconds)}</>;
}
