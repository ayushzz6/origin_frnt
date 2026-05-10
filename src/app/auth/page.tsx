'use client';

import { Suspense, useEffect } from 'react';
import AuthPage from '@/sections/AuthPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleOAuthProvider } from '@react-oauth/google';

function AuthPageContent() {
  const { user, userRole, login, loginWithOtp, register, googleLogin, isLoading, authError, sendOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get ? searchParams.get('next') : (searchParams as any).next;
  const role = searchParams.get ? searchParams.get('role') : (searchParams as any).role;
  const requestedRole = searchParams.get('role');
  const nextParam = searchParams.get('next');

  const isAdminRedirect = nextParam === '/admin' || nextParam?.startsWith('/admin/');

  // Guard: Redirect authenticated users away from /auth
  useEffect(() => {
    if (user && !isLoading) {
      if (user.role === 'student' && !user.isOnboarded) {
        router.push('/onboarding');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  const selectedRole =
    requestedRole === 'student' || requestedRole === 'teacher' || requestedRole === 'admin'
      ? requestedRole as 'student' | 'teacher' | 'admin'
      : null;

  if (user && !isLoading) return null; // Avoid rendering the form if already logged in

  return (
    <AuthPage
      userRole={
        user
          ? user.role === 'student' || user.role === 'teacher' || user.role === 'admin'
            ? user.role
            : null
          : (selectedRole || (isAdminRedirect ? 'admin' : 'student')) ?? (userRole as any)
      }
      onLogin={login}
      onLoginWithOtp={loginWithOtp}
      onRegister={register}
      onGoogleLogin={googleLogin}
      sendOtp={sendOtp}
      verifyOtp={verifyOtp}
      onBack={() => router.push('/')}
      isLoading={isLoading}
      error={authError}
    />
  );
}

export default function Auth() {
  return (
    <Suspense fallback={null}>
      <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'}>
        <AuthPageContent />
      </GoogleOAuthProvider>
    </Suspense>
  );
}
