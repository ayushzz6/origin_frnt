import { redirect } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import PremiumClient from './_client';

export default function PremiumPage() {
  // Premium surface ships dark behind `premiumSubscriptions`. While it is off
  // (the default), the page is not reachable — bounce to the dashboard so no
  // subscription/upgrade screen renders. Re-enabling is purely a flag flip.
  if (!isFeatureEnabled('premiumSubscriptions')) {
    redirect('/dashboard');
  }
  return <PremiumClient />;
}
