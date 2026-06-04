export const dynamic = "force-dynamic";

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
import { getCollaboratorProfile } from "@/server/connect/connect-service";

import { gateConnectStudent } from "../../_gate";

function formatPrice(minor: number, currency: string): string {
  const amount = (minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return currency === "INR" ? `₹${amount}` : `${currency} ${amount}`;
}

export default async function CollaboratorProfilePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  await gateConnectStudent();
  const { workspaceId } = await params;
  const profile = await getCollaboratorProfile(workspaceId);
  if (!profile) notFound();

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {[profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "Online"}
            {" · "}
            {profile.studentCount} students · {profile.batchCount} batches
          </p>
        </div>
        {profile.verified ? <Badge>Verified</Badge> : null}
      </div>

      {profile.subjects.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {profile.subjects.map((s) => (
            <Badge key={s} variant="outline">
              {s}
            </Badge>
          ))}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Course offerings</h2>
        {profile.activeOfferings.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No offerings yet</CardTitle>
              <CardDescription>
                This institute hasn&apos;t published any in-app course offerings. If you have a code,
                redeem it from the Connect page.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile.activeOfferings.map((offering) => (
              <Card key={offering.id}>
                <CardHeader>
                  <CardTitle>{offering.title}</CardTitle>
                  {offering.description ? (
                    <CardDescription>{offering.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {formatPrice(offering.priceMinor, offering.currency)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link
                      href={`/connect/checkout/${offering.id}?workspaceId=${profile.workspaceId}`}
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
    </div>
  );
}
