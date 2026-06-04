export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { ConnectCheckout } from "@/components/connect/ConnectCheckout";
import { getCollaboratorProfile } from "@/server/connect/connect-service";

import { gateConnectStudent } from "../../_gate";

function formatPrice(minor: number, currency: string): string {
  const amount = (minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return currency === "INR" ? `₹${amount}/month` : `${currency} ${amount}/month`;
}

export default async function ConnectCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  await gateConnectStudent();
  const { offeringId } = await params;
  const { workspaceId } = await searchParams;
  if (!workspaceId) notFound();

  const profile = await getCollaboratorProfile(workspaceId);
  if (!profile) notFound();
  const offering = profile.activeOfferings.find((o) => o.id === offeringId);
  if (!offering) notFound();

  return (
    <div className="container mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enroll with {profile.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          Complete your in-app enrollment for this course offering.
        </p>
      </div>
      <ConnectCheckout
        workspaceId={profile.workspaceId}
        offeringId={offering.id}
        offeringTitle={offering.title}
        priceLabel={formatPrice(offering.priceMinor, offering.currency)}
      />
    </div>
  );
}
