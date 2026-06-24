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
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Find students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search by @username or name, follow them, and track their progress.
          </p>
        </div>

        <StudentSearch autoFocus />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-black tracking-tight text-sm uppercase tracking-widest text-muted-foreground">
              People you follow
            </h2>
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
              See all
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
