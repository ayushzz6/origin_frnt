export const dynamic = "force-dynamic";

/**
 * Phase 12 — checkout page.
 *
 * Server component that loads the offering, then mounts the client
 * checkout island that posts to /api/enrollments/orders to create the
 * order. The actual payment-provider hand-off (Razorpay/Cashfree)
 * lives behind a server action stub; in a real production flow this
 * page would forward to the provider's hosted checkout.
 */

import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutForm } from "@/components/marketplace/CheckoutForm";
import { getServerUser } from "@/lib/auth-server";
import { getOfferingService } from "@/server/workspaces/marketplace-service";

type Props = {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
};

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { offeringId } = await params;
  const { workspaceId } = await searchParams;
  if (!workspaceId) notFound();

  const user = await getServerUser();
  if (!user) {
    redirect(
      `/auth?next=${encodeURIComponent(
        `/marketplace/checkout/${offeringId}?workspaceId=${workspaceId}`,
      )}`,
    );
  }

  const offering = await getOfferingService(workspaceId, offeringId);
  if (!offering) notFound();

  return (
    <div className="container mx-auto max-w-2xl space-y-6 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>

      <Card>
        <CardHeader>
          <CardTitle>{offering.title}</CardTitle>
          <CardDescription>
            {offering.description ?? "No description provided."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-3xl font-bold">
              {formatPrice(offering.priceMinor, offering.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              One-time payment. Refunds follow the institute&apos;s policy.
            </p>
          </div>
          <Badge variant={offering.status === "active" ? "default" : "outline"}>
            {offering.status}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confirm your purchase</CardTitle>
          <CardDescription>
            We&apos;ll create an order and forward you to the payment
            provider. Duplicate clicks return the same order — no double
            charges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckoutForm workspaceId={workspaceId} offeringId={offeringId} />
        </CardContent>
      </Card>
    </div>
  );
}
