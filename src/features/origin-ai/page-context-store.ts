'use client';

import React from 'react';

import { buildOriginAiPageContext, type OriginAiClientPageContext } from '@/features/origin-ai/client';

type Listener = () => void;

let currentContext: OriginAiClientPageContext | null = null;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function mergeContext(pathname: string): OriginAiClientPageContext {
  const base = buildOriginAiPageContext(pathname);
  if (!currentContext) {
    return base;
  }

  if (currentContext.pathname && currentContext.pathname !== pathname) {
    return base;
  }

  return {
    ...base,
    ...currentContext,
    pathname,
  };
}

export function setOriginAiPageContext(nextContext: OriginAiClientPageContext | null): void {
  currentContext = nextContext;
  emitChange();
}

export function clearOriginAiPageContext(pathname?: string): void {
  if (!currentContext) {
    return;
  }

  if (pathname && currentContext.pathname && currentContext.pathname !== pathname) {
    return;
  }

  currentContext = null;
  emitChange();
}

export function useOriginAiPageContext(pathname: string): OriginAiClientPageContext {
  const [pageContext, setPageContext] = React.useState<OriginAiClientPageContext>(() => mergeContext(pathname));

  React.useEffect(() => {
    const handleChange = () => {
      setPageContext(mergeContext(pathname));
    };

    listeners.add(handleChange);
    handleChange();

    return () => {
      listeners.delete(handleChange);
    };
  }, [pathname]);

  return pageContext;
}

export function usePublishOriginAiPageContext(context: OriginAiClientPageContext | null): void {
  React.useEffect(() => {
    if (!context) {
      return;
    }

    setOriginAiPageContext(context);

    return () => {
      clearOriginAiPageContext(context.pathname);
    };
  }, [context]);
}
