import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { listFollowing, type SocialUserCard } from '@/server/social/social-service';
import StudentSearch from '@/components/social/StudentSearch';
import StudentList from '@/components/social/StudentList';

export default async function SocialPage() {
  if (!isFeatureEnabled('studentSocial')) notFound();

  const viewer = await getServerUser();
  if (!viewer) redirect('/');

  let following: SocialUserCard[] = [];
  if (viewer.username) {
    try {
      const result = await listFollowing(viewer.username, viewer.id, 0);
      following = result.items;
    } catch {
      following = [];
    }
  }

  return (
    <div className="min-h-screen neu-surface">
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Find students</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search by @username or name, follow them, and track their progress.
            </p>
          </div>
        </div>

        <StudentSearch autoFocus />

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Users className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              People you follow
            </p>
          </div>
          <StudentList
            users={following}
            emptyLabel="You're not following anyone yet — search above to get started."
          />
          {viewer.username && following.length > 0 && (
            <Link
              href={`/u/${viewer.username}/following`}
              className="inline-block text-xs font-bold text-primary hover:underline"
            >
              See all →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
