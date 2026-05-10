import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';

/**
 * Server-side auth guard for every /admin/* route. The cookie read lives
 * in this protected layout so admin pages do not duplicate role checks.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  if (!user || user.role !== 'admin') {
    redirect('/auth?role=admin');
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      {children}
    </Suspense>
  );
}
