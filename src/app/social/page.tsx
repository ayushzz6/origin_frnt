import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getPopularStudents, type PopularStudents } from '@/server/social/social-service';
import SocialDashboard from '@/components/social/SocialDashboard';

export default async function SocialPage() {
  if (!isFeatureEnabled('studentSocial')) notFound();

  const viewer = await getServerUser();
  if (!viewer) redirect('/');

  let popular: PopularStudents = { followed: [], ranked: [], active: [] };
  try {
    popular = await getPopularStudents(viewer.id);
  } catch {
    popular = { followed: [], ranked: [], active: [] };
  }

  return (
    <SocialDashboard
      data={popular}
      viewerName={viewer.name}
      viewerUsername={viewer.username ?? null}
    />
  );
}
