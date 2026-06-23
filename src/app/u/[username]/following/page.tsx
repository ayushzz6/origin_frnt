import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { listFollowing } from '@/server/social/social-service';
import FollowListView from '@/components/social/FollowListView';

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!isFeatureEnabled('studentSocial')) notFound();

  const viewer = await getServerUser();
  if (!viewer) redirect('/');

  const { username } = await params;
  const result = await listFollowing(username, viewer.id, 0).catch(() => null);
  if (!result) notFound();

  return (
    <FollowListView
      username={username}
      direction="following"
      title="Following"
      initialItems={result.items}
      initialHasMore={result.hasMore}
      hidden={result.hidden}
    />
  );
}
