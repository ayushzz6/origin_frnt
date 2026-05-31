'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { ViewState } from '@/types';
import Navbar from './Navbar';
import { useTheme } from 'next-themes';
import { TutorialProvider } from '@/features/tutorial/TutorialProvider';
import { cn } from '@/lib/utils';
import { useResizable } from '@/hooks/use-resizable';
import AiSidebar from './AiSidebar';
import { LayoutProvider, useLayout } from '@/context/LayoutContext';
import { TimeTrackerProvider } from '@/context/TimeTrackerContext';
import Lenis from 'lenis';

const FloatingChat = dynamic(() => import('./FloatingChat'), { ssr: false });
const TutorialOverlay = dynamic(() =>
  import('@/features/tutorial/TutorialOverlay').then((module) => module.TutorialOverlay),
  { ssr: false },
);

const ROUTES: Record<string, string> = {
  'landing': '/',
  'dashboard': '/dashboard',
  'auth': '/auth',
  'test-list': '/tests',
  'test-interface': '/tests',
  'test-result': '/tests/result',
  'study-rooms': '/study-rooms',
  'ogcode': '/ogcode',
  'ogcode-workspace': '/ogcode',
  'doubt-solver': '/doubt-solver',
  'dpp': '/dpp',
  'tasks-goals': '/tasks',
  'explore': '/explore',
  'profile': '/profile',
  'premium': '/premium',
  'study-corner': '/study-corner',
  'pomodoro': '/pomodoro',
  'leaderboard': '/leaderboard',
  'milestones': '/milestones',
  'prestige-milestones': '/milestones',
};

function resolveRoute(view: string) {
  return ROUTES[view] || `/${view}`;
}

function ClientShellInner({ children }: { children: React.ReactNode }) {
  const { user, logout, isNavigationLocked } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { 
    setSidebarWidth, 
    setIsAiOpen: setContextAiOpen, 
    askSelectionNonce: globalAskNonce,
    triggerAskSelection
  } = useLayout();
  const [mounted, setMounted] = React.useState(false);
  const [deferredUiReady, setDeferredUiReady] = React.useState(false);

  const mainRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!mounted) return;
    const mainElement = mainRef.current;
    if (!mainElement) return;

    const lenis = new Lenis({
      wrapper: mainElement,
      content: (mainElement.firstElementChild as HTMLElement) || mainElement,
      duration: 0.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
      infinite: false,
      wheelMultiplier: 1.2,
      lerp: 0.18,
      syncTouch: false,
      syncTouchLerp: 0.075,
    });

    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    let rafId = requestAnimationFrame(raf);

    (window as any).lenis = lenis;

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      delete (window as any).lenis;
    };
  }, [mounted]);

  React.useEffect(() => {
    const mainElement = mainRef.current;
    if (mainElement) {
      mainElement.scrollTop = 0;
      if ((window as any).lenis && typeof (window as any).lenis.scrollTo === 'function') {
        (window as any).lenis.scrollTo(0, { immediate: true });
      }
    }
  }, [pathname]);

  // Side AI State
  const [isAiOpen, setIsAiOpenInternal] = React.useState(false);

  // Sync state with context
  React.useEffect(() => {
    setContextAiOpen(isAiOpen);
  }, [isAiOpen, setContextAiOpen]);

  const [aiSide, setAiSide] = React.useState<'left' | 'right'>('right');

  // Auto-open AI when global ask nonce changes
  React.useEffect(() => {
    if (globalAskNonce > 0) {
      setIsAiOpenInternal(true);
    }
  }, [globalAskNonce]);

  const { width: aiWidth, isResizing, startResizing } = useResizable({
    initialWidth: typeof window !== 'undefined' ? window.innerWidth * 0.2 : 400,
    minWidth: 320,
    maxWidth: 800,
    side: aiSide,
  });

  // Sync with layout context
  React.useEffect(() => {
    setSidebarWidth(isAiOpen ? aiWidth : 0);
  }, [aiWidth, isAiOpen, setSidebarWidth]);

  const toggleAi = React.useCallback((options?: { autoAskSelection?: boolean }) => {
    if (options?.autoAskSelection) {
      triggerAskSelection();
    }
    setIsAiOpenInternal(true);
  }, [triggerAskSelection]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDeferredUiReady(true);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [mounted]);

  // Route-based default theme initialization
  React.useEffect(() => {
    if (!mounted) return;

    const isLanding = pathname === '/';
    // Define app routes as anything authenticated and not a public/auth page
    const isApp = !!user && !['/', '/auth', '/role-selection'].includes(pathname);

    if (isLanding) {
      const landingInit = localStorage.getItem('origin-landing-init');
      if (!landingInit) {
        setTheme('dark');
        localStorage.setItem('origin-landing-init', 'true');
      }
    } else if (isApp) {
      const appInit = localStorage.getItem('origin-app-init');
      if (!appInit) {
        setTheme('light');
        localStorage.setItem('origin-app-init', 'true');
      }
    }
  }, [pathname, user, mounted, setTheme]);

  const prefetchRoute = React.useCallback((view: string) => {
    router.prefetch(resolveRoute(view));
  }, [router]);

  React.useEffect(() => {
    if (!mounted || !user || isNavigationLocked) {
      return;
    }

    const routesToPrefetch = user.role === 'teacher'
      ? ['/dashboard', '/profile']
      : ['/dashboard', '/ogcode', '/tests', '/dpp', '/tasks', '/study-corner', '/pomodoro', '/leaderboard', '/milestones', '/profile'];

    const timeoutId = window.setTimeout(() => {
      routesToPrefetch.forEach((route) => router.prefetch(route));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isNavigationLocked, mounted, router, user]);

  const handleNavigate = (view: string) => {
    router.push(resolveRoute(view));
  };

  const noNavbarPaths = ['/', '/auth', '/onboarding', '/role-selection'];
  const isTestsPath = pathname === '/tests' || pathname.startsWith('/tests/');
  const isStudyRoomTestPath = /^\/study-rooms\/[^/]+\/test/.test(pathname);
  const isSpecialPath = pathname.startsWith('/tests/') || pathname.startsWith('/ogcode/') || isStudyRoomTestPath;
  const isFullViewportApp = pathname === '/doubt-solver' || pathname.startsWith('/tests/') || isStudyRoomTestPath;
  const shouldHideOriginAi = isTestsPath || isStudyRoomTestPath;
  const shouldShowFloatingOriginAi =
    deferredUiReady &&
    !!user &&
    !noNavbarPaths.includes(pathname) &&
    !shouldHideOriginAi;
  
  const currentTheme = (mounted ? resolvedTheme : 'dark') || 'dark';
  const showNavbar = mounted && !!user && user.role === 'student' && !isNavigationLocked && !noNavbarPaths.includes(pathname) && !isSpecialPath;

  return (
    <TutorialProvider>
      <div id="tutorial-welcome" className={cn(
        "h-dvh bg-background text-foreground font-sans antialiased overflow-hidden relative flex transition-colors duration-700",
        aiSide === 'right' ? 'flex-row' : 'flex-row-reverse'
      )}>
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative h-dvh">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-40 dark:opacity-20">
            <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[100px]" />
          </div>

          {mounted && showNavbar && (
            <Navbar
              user={user}
              currentView={pathname.replace('/', '') as ViewState}
              onNavigate={handleNavigate}
              onPrefetch={prefetchRoute}
              onLogout={logout}
              theme={currentTheme as "dark" | "light" | "system"}
              setTheme={setTheme}
            />
          )}
          <main 
            ref={mainRef}
            className={cn(
              "flex-1 flex flex-col relative z-10 overflow-x-hidden custom-scrollbar",
              isFullViewportApp ? "overflow-hidden" : "overflow-y-auto",
              "transition-all duration-300 min-w-[320px]",
              mounted && showNavbar ? 'pt-[92px]' : ''
            )}
          >
            <div className="flex-1 flex flex-col relative w-full max-w-full h-full min-h-0">
              {children}
            </div>
          </main>
        </div>

        {/* Resizable AI Sidebar */}
        {shouldShowFloatingOriginAi && (
           <AiSidebar 
            isOpen={isAiOpen}
            onClose={() => setIsAiOpenInternal(false)}
            width={aiWidth}
            isResizing={isResizing}
            onResizeStart={startResizing}
            side={aiSide}
            onSideToggle={() => setAiSide(prev => prev === 'left' ? 'right' : 'left')}
            autoAskSelectionNonce={globalAskNonce}
          />
        )}

        {shouldShowFloatingOriginAi && (
          <FloatingChat 
            onOpen={toggleAi} 
            autoAskSelectionNonce={globalAskNonce} 
            hideMainButton={isAiOpen} 
          />
        )}

        {deferredUiReady ? <TutorialOverlay /> : null}
      </div>
    </TutorialProvider>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <TimeTrackerProvider>
        <ClientShellInner>{children}</ClientShellInner>
      </TimeTrackerProvider>
    </LayoutProvider>
  );
}
