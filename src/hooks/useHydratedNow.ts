'use client';

import { useSyncExternalStore } from 'react';

let hydratedNow: number | null = null;

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  if (hydratedNow === null) {
    hydratedNow = Date.now();
  }
  return hydratedNow;
}

function getServerSnapshot() {
  return null;
}

export function useHydratedNow(): number | null {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
