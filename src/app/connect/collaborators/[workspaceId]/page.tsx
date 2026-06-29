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
import { getBrowsableInstituteProfile } from "@/server/connect/connect-service";
import { listStudentBatches } from "@/server/workspaces/batches";

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
  const user = await gateConnectStudent();
  const { workspaceId } = await params;
  const profile = await getBrowsableInstituteProfile(workspaceId);
  if (!profile) notFound();

  // The student's own batches at this institute — entry points to each batch's
  // study materials + chat feed.
  const myBatches = await listStudentBatches(workspaceId, user.id).catch(() => []);

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

      {myBatches.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Your batches</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myBatches.map((b) => (
              <Card key={b.id} className="transition hover:border-primary/40">
                <CardHeader>
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  {b.subject ? <CardDescription>{b.subject}</CardDescription> : null}
                </CardHeader>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/connect/batches/${b.id}`}>Materials &amp; chat →</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
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
