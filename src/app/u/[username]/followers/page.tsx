import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { listFollowers } from '@/server/social/social-service';
import FollowListView from '@/components/social/FollowListView';

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!isFeatureEnabled('studentSocial')) notFound();

  const viewer = await getServerUser();
  if (!viewer) redirect('/');

  const { username } = await params;
  const result = await listFollowers(username, viewer.id, 0).catch(() => null);
  if (!result) notFound();

  return (
    <FollowListView
      username={username}
      direction="followers"
      title="Followers"
      initialItems={result.items}
      initialHasMore={result.hasMore}
      hidden={result.hidden}
    />
  );
}
