export const dynamic = "force-dynamic";

/**
 * Phase 12 — student-facing marketplace landing.
 *
 * Lists verified-then-recent institutes. Filterable by subject + city
 * via query string; clicking through opens the institute profile with
 * its active offerings.
 */

import Link from "next/link";

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
import { listPublicInstitutesService } from "@/server/workspaces/marketplace-service";

type Props = {
  searchParams: Promise<{
    subject?: string;
    city?: string;
  }>;
};

export default async function MarketplacePage({ searchParams }: Props) {
  const sp = await searchParams;
  const institutes = await listPublicInstitutesService({
    subject: sp.subject,
    city: sp.city,
    limit: 60,
  });

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Browse verified institutes on ORIGIN. Pick a course offering to
          enroll directly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" method="get">
            <input
              name="subject"
              placeholder="Subject (e.g. Physics)"
              defaultValue={sp.subject ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="city"
              placeholder="City (e.g. Bengaluru)"
              defaultValue={sp.city ?? ""}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {institutes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matching institutes</CardTitle>
            <CardDescription>
              Try removing some filters, or check back as more institutes
              onboard.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {institutes.map((inst) => (
            <Card key={inst.workspaceId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{inst.displayName}</CardTitle>
                  {inst.verified ? (
                    <Badge variant="default">Verified</Badge>
                  ) : null}
                </div>
                <CardDescription>
                  {[inst.city, inst.state, inst.country]
                    .filter(Boolean)
                    .join(", ") || "Online"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {inst.subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {inst.subjects.slice(0, 6).map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {inst.studentCount} students · {inst.batchCount} batches
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/marketplace/institutes/${inst.workspaceId}`}>
                    View profile
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
