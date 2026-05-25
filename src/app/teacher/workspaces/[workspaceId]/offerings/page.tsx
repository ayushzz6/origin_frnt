export const dynamic = "force-dynamic";

/**
 * Phase 12 — teacher offerings management.
 */

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OfferingEditor } from "@/components/teacher/marketplace/OfferingEditor";
import { OfferingRowActions } from "@/components/teacher/marketplace/OfferingRowActions";
import { listOfferingsService } from "@/server/workspaces/marketplace-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function TeacherOfferingsPage({ params }: Props) {
  const { workspaceId } = await params;
  const { userId, membership, isPlatformAdmin } =
    await loadWorkspaceForRender(workspaceId);
  const canManage =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";
  const offerings = canManage
    ? await listOfferingsService(workspaceId, userId, { status: "all" })
    : [];

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offerings</h1>
          <p className="text-sm text-muted-foreground">
            Publish purchasable enrollments to the ORIGIN marketplace.
          </p>
        </div>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Create offering</CardTitle>
            <CardDescription>
              Drafts are private; mark Active to expose on the marketplace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OfferingEditor workspaceId={workspaceId} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Offering management is restricted</CardTitle>
            <CardDescription>
              Ask an owner, admin, or teacher to create offerings.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{offerings.length} offering{offerings.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {offerings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No offerings yet. Use the form above to publish one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Target batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offerings.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.title}</TableCell>
                    <TableCell>
                      {o.currency} {(o.priceMinor / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {o.targetBatchId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={o.status === "active" ? "default" : "outline"}
                      >
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/marketplace/institutes/${workspaceId}`}
                            target="_blank"
                          >
                            Preview
                          </Link>
                        </Button>
                        {canManage ? (
                          <OfferingRowActions
                            workspaceId={workspaceId}
                            offeringId={o.id}
                            status={o.status}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
