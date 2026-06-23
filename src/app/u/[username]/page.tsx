import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getPublicProfile } from '@/server/social/social-service';
import PublicProfile from '@/sections/PublicProfile';

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!isFeatureEnabled('studentSocial')) notFound();

  const viewer = await getServerUser();
  if (!viewer) redirect('/');

  const { username } = await params;
  const profile = await getPublicProfile(viewer.id, username);
  if (!profile) notFound();

  return <PublicProfile initialProfile={profile} />;
}
