'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { User, StreakData, Task } from '@/types';
import { clearOriginAiBrowserSession } from '@/features/origin-ai/session';
import { AUTH_EXPIRED_EVENT, attemptTokenRefresh } from '@/lib/api';
import {
  addTaskAction,
  listTasksAction,
  removeTaskAction,
  toggleTaskAction,
} from '@/server/actions/task-actions';
import {
  googleLoginAction,
  loginAction,
  loginWithOtpAction,
  logoutAction,
  refreshTokenAction,
  refreshUserAction,
  registerAction,
} from '@/server/actions/auth-actions';
import { sendOtpAction, verifyOtpAction } from '@/server/actions/otp-actions';

interface AuthContextType {
  user: User | null;
  userRole: 'student' | 'teacher' | 'admin' | null;
  streakData: StreakData;
  isLoading: boolean;
  authError: string | null;
  tasks: Task[];
  tasksLoading: boolean;
  login: (email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  loginWithOtp: (email: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  register: (name: string, email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  addTask: (text: string, due: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  primeTasks: (seededTasks: Task[]) => void;
  isNavigationLocked: boolean;
  setIsNavigationLocked: (locked: boolean) => void;
  sendOtp: (email: string) => Promise<{ ok: boolean; message: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ ok: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMPTY_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  weeklyData: [false, false, false, false, false, false, false],
};

const PUBLIC_PATHS = ['/', '/auth', '/role-selection'];

function normalizeRole(role: User['role'] | undefined): 'student' | 'teacher' | 'admin' | null {
  return role === 'student' || role === 'teacher' || role === 'admin' ? role : null;
}

interface AuthProviderProps {
  children: React.ReactNode;
  /**
   * Server-resolved user, seeded from the root layout via `getServerFrontendUser`.
   * When present, the provider starts fully hydrated with no loading state and
   * no blocking `/users/me` round-trip.
   */
  initialUser: User | null;
}

const ACCESS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const ACCESS_REFRESH_MIN_SPACING_MS = 60 * 1000;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialUser }) => {
  const [user, setUser] = useState<User | null>(initialUser);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin' | null>(
    normalizeRole(initialUser?.role),
  );
  const [streakData, setStreakData] = useState<StreakData>(initialUser?.streakData ?? EMPTY_STREAK);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(typeof window !== 'undefined' && !initialUser);
  const [authRecoveryBlocked, setAuthRecoveryBlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);
  const tasksFetched = useRef(false);
  const lastSessionRefreshAt = useRef(Date.now());
  const authExpiredRecovery = useRef<Promise<void> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const applyUserData = useCallback((userData: User) => {
    lastSessionRefreshAt.current = Date.now();
    setUser(userData);
    if (userData.streakData) setStreakData(userData.streakData);
    setUserRole(normalizeRole(userData.role));
  }, []);

  const fetchTasks = useCallback(async () => {
    if (tasksFetched.current) return;
    tasksFetched.current = true;
    setTasksLoading(true);
    try {
      const data = await listTasksAction();
      setTasks((data ?? []) as unknown as Task[]);
    } catch {
      // Non-fatal — tasks stay empty, user can still use the app
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const primeTasks = useCallback((seededTasks: Task[]) => {
    tasksFetched.current = true;
    setTasksLoading(false);
    setTasks((current) => (current.length > 0 ? current : seededTasks));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await refreshUserAction();
      if (userData) applyUserData(userData);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to refresh user:', error);
      }
    }
  }, [applyUserData]);

  const refreshActiveSession = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - lastSessionRefreshAt.current < ACCESS_REFRESH_MIN_SPACING_MS) return;

    const result = await refreshTokenAction();
    if (result.ok) {
      lastSessionRefreshAt.current = Date.now();
      setAuthRecoveryBlocked(false);
      return;
    }

    const stillAuthenticated = await refreshUserAction();
    if (stillAuthenticated) {
      applyUserData(stillAuthenticated);
      setAuthRecoveryBlocked(false);
      return;
    }

    if (result.status === 429 || result.status >= 500) {
      setAuthRecoveryBlocked(true);
      return;
    }

    setAuthRecoveryBlocked(true);
  }, [applyUserData, user]);

  // 1. Session Hydration: derive auth from the HttpOnly cookie, never from
  // browser-readable token storage.
  useEffect(() => {
    const hydrate = async () => {
      // If we have an initial user from the server, we're already hydrated.
      if (initialUser) {
        setAuthRecoveryBlocked(false);
        setIsHydrating(false);
        return;
      }

      const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
      if (normalizedPath === '/auth') {
        setAuthRecoveryBlocked(false);
        setIsHydrating(false);
        return;
      }

      try {
        const response = await fetch('/api/users/me', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          const userData = data.user ?? data;
          if (userData?.id) {
            applyUserData(userData);
            setAuthRecoveryBlocked(false);
          }
        } else if (response.status === 401) {
          const refreshResult = await attemptTokenRefresh();
          
          if (refreshResult === 'ok') {
            const retryRes = await fetch('/api/users/me', {
              credentials: 'include',
              cache: 'no-store',
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              const retryUser = retryData.user ?? retryData;
              if (retryUser?.id) {
                applyUserData(retryUser);
                setAuthRecoveryBlocked(false);
              }
            } else if (retryRes.status === 429 || retryRes.status >= 500) {
              setAuthRecoveryBlocked(true);
            }
          } else if (refreshResult === 'transient') {
            setAuthRecoveryBlocked(true);
          }
        } else if (response.status === 429 || response.status >= 500) {
          setAuthRecoveryBlocked(true);
        }
      } catch (err) {
        console.error('[AuthContext] Hydration failed:', err);
        setAuthRecoveryBlocked(true);
      } finally {
        setIsHydrating(false);
      }
    };

    hydrate();
  }, [initialUser, applyUserData, pathname]);

  // Keep the short-lived access cookie warm while an authenticated user is
  // still active, so idle clicks do not have to go through a hard page refresh.
  useEffect(() => {
    if (!user) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshActiveSession(false);
      }
    };
    const interval = window.setInterval(() => {
      void refreshActiveSession(true);
    }, ACCESS_REFRESH_INTERVAL_MS);

    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    document.addEventListener('pointerdown', refreshIfVisible, { capture: true, passive: true });

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      document.removeEventListener('pointerdown', refreshIfVisible, { capture: true });
    };
  }, [user, refreshActiveSession]);

  // Auth-expired listener only.
  useEffect(() => {
    const handleAuthExpired = () => {
      if (authExpiredRecovery.current) return;

      authExpiredRecovery.current = (async () => {
        setAuthRecoveryBlocked(true);

        try {
          const refreshResult = await refreshTokenAction();
          const refreshedUser = await refreshUserAction();

          if (refreshResult.ok && refreshedUser) {
            applyUserData(refreshedUser);
            setAuthRecoveryBlocked(false);
            return;
          }

          if (refreshedUser) {
            applyUserData(refreshedUser);
            setAuthRecoveryBlocked(false);
            return;
          }

          if (refreshResult.status === 429 || refreshResult.status >= 500) {
            return;
          }
        } catch {
          return;
        }

        setUser(null);
        setUserRole(null);
        setTasks([]);
        tasksFetched.current = false;
        clearOriginAiBrowserSession();
        window.location.href = '/';
        toast.error('Your session expired. Please log in again.');
      })().finally(() => {
        authExpiredRecovery.current = null;
      });
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [applyUserData]);

  // Runs on every route change and keeps protected and guest-only pages aligned
  // with the current auth state.
  useEffect(() => {
    if (isLoading || isHydrating || authRecoveryBlocked) return;

    // Normalize path for robust matching (remove trailing slash except for root)
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const isPublicPath = PUBLIC_PATHS.some(p => normalizedPath === p);

    // 1. Unauthenticated users: redirect away from protected pages
    if (!user && !isPublicPath && !normalizedPath.startsWith('/admin')) {
      window.location.href = '/';
      return;
    }

    // 2. Authenticated users: redirect away from guest pages
    if (user && isPublicPath) {
      if (user.role === 'student' && !user.isOnboarded) {
        router.push('/onboarding');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [pathname, user, isLoading, isHydrating, authRecoveryBlocked, router]);

  const login = async (email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await loginAction({ email, password, role: role ?? null });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();

      setAuthRecoveryBlocked(false);
      setUser(result.user);
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      toast.success('Welcome back to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithOtp = async (email: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await loginWithOtpAction({ email, role: role ?? null });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();

      setAuthRecoveryBlocked(false);
      setUser(result.user);
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      toast.success('Welcome back to ORIGIN!');
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await registerAction({ name, email, password, role: role ?? null });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();

      setAuthRecoveryBlocked(false);
      setUser(result.user);
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      toast.success('Registration successful! Welcome to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (email: string) => {
    setIsLoading(true);
    try {
      const result = await sendOtpAction(email);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP';
      toast.error(message);
      return { ok: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const result = await verifyOtpAction(email, otp);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify OTP';
      toast.error(message);
      return { ok: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (credential: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await googleLoginAction({ credential });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();

      setAuthRecoveryBlocked(false);
      setUser(result.user);
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      toast.success('Google login successful! Welcome to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Login failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // 1. Clear client state immediately
    clearOriginAiBrowserSession();
    setTasks([]);
    tasksFetched.current = false;

    try {
      // 2. Clear server-side cookies and revalidate
      await logoutAction();
    } catch (error) {
      console.error('Server-side logout failed:', error);
    }

    // 3. Finally clear the user state which might trigger re-renders
    setUser(null);
    setUserRole(null);
    setAuthRecoveryBlocked(false);

    // 4. Force hard redirect to landing page to purge any remaining memory state
    window.location.href = '/';
  };

  const addTask = async (text: string, due: string) => {
    const tempId = `temp_${Date.now()}`;
    const optimistic: Task = { id: tempId, text, due, completed: false };
    setTasks(prev => [optimistic, ...prev]);
    try {
      const created = await addTaskAction({ text, due });
      setTasks(prev => prev.map(t => t.id === tempId ? (created as unknown as Task) : t));
    } catch {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      toast.error('Failed to save task. Please try again.');
    }
  };

  const toggleTask = async (id: string) => {
    const original = tasks.find(t => t.id === id);
    if (!original) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try {
      await toggleTaskAction(id, !original.completed);
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? original : t));
      toast.error('Failed to update task.');
    }
  };

  const removeTask = async (id: string) => {
    const original = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await removeTaskAction(id);
    } catch {
      if (original) setTasks(prev => [original, ...prev]);
      toast.error('Failed to delete task.');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      streakData,
      isLoading,
      authError,
      tasks,
      tasksLoading,
      login,
      loginWithOtp,
      register,
      googleLogin,
      logout,
      refreshUser,
      addTask,
      toggleTask,
      removeTask,
      primeTasks,
      isNavigationLocked,
      setIsNavigationLocked,
      sendOtp,
      verifyOtp,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
