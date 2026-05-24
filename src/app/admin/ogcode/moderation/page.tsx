export const dynamic = "force-dynamic";

/**
 * Phase 11 — admin OGCode moderation queue.
 */

import { Badge } from "@/components/ui/badge";
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
import { AdminModerationActions } from "@/components/admin/AdminModerationActions";
import { getModerationQueue } from "@/server/workspaces/ogcode-publishing-service";

export default async function AdminOgcodeModerationPage() {
  const queue = await getModerationQueue(100);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OGCode Moderation</h1>
        <p className="text-sm text-muted-foreground">
          Teacher / institute submissions awaiting publication review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {queue.length} submission{queue.length === 1 ? "" : "s"} pending
          </CardTitle>
          <CardDescription>
            Approve to mark as ready; publish to push to OGCode immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The queue is empty. Nice.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attribution</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((pub) => (
                  <TableRow key={pub.id}>
                    <TableCell>
                      <Badge variant="outline">{pub.attributionName}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm">
                      {pub.questionStem ?? "(stem missing)"}
                    </TableCell>
                    <TableCell className="text-xs uppercase">
                      {pub.questionSubject ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pub.submittedAt
                        ? new Date(pub.submittedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AdminModerationActions publicationId={pub.id} />
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
