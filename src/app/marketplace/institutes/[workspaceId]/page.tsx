export const dynamic = "force-dynamic";

/**
 * Phase 12 — institute public profile + offering list.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInstituteProfileService } from "@/server/workspaces/marketplace-service";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

function formatPrice(minor: number, currency: string): string {
  const major = (minor / 100).toFixed(2);
  return `${currency} ${major}`;
}

export default async function InstituteProfilePage({ params }: Props) {
  const { workspaceId } = await params;
  const profile = await getInstituteProfileService(workspaceId);
  if (!profile) notFound();

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile.displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[profile.city, profile.state, profile.country]
              .filter(Boolean)
              .join(", ")}{" "}
            · {profile.studentCount} students · {profile.batchCount} batches
            {profile.verified ? (
              <Badge variant="default" className="ml-2">
                Verified
              </Badge>
            ) : null}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/marketplace">Back to marketplace</Link>
        </Button>
      </div>

      {profile.subjects.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {profile.subjects.map((s) => (
            <Badge key={s} variant="outline">
              {s}
            </Badge>
          ))}
        </div>
      ) : null}

      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {profile.activeOfferings.length} offering
          {profile.activeOfferings.length === 1 ? "" : "s"}
        </h2>
      </div>

      {profile.activeOfferings.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No active offerings</CardTitle>
            <CardDescription>
              This institute hasn&apos;t published any purchasable offerings
              yet. Check back soon.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profile.activeOfferings.map((off) => (
            <Card key={off.id}>
              <CardHeader>
                <CardTitle>{off.title}</CardTitle>
                <CardDescription>
                  {off.description ?? "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatPrice(off.priceMinor, off.currency)}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link
                    href={`/marketplace/checkout/${off.id}?workspaceId=${workspaceId}`}
                  >
                    Enroll
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
