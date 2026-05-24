export const dynamic = "force-dynamic";

/**
 * Phase 13 — admin incident controls page.
 *
 * Surfaces:
 *  - kill-switch toggles for every FlagKey,
 *  - rate-limit mode (relaxed / normal / strict / lockdown),
 *  - force-logout-user form,
 *  - close-workspace form.
 *
 * The actual mutations go through POST /api/admin/incidents/<action>
 * so they show up in app.audit_events alongside every other admin
 * action. This page is a thin server-rendered shell — the client
 * pieces are deliberately small to keep the surface low-risk.
 */

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getIncidentSnapshot, RATE_LIMIT_MODE_DESCRIPTIONS, type RateLimitMode } from "@/server/incidents";

import { IncidentControlForms } from "./IncidentControlForms";

type Snapshot = Awaited<ReturnType<typeof getIncidentSnapshot>>;

const FLAG_DESCRIPTIONS: Record<string, string> = {
  workspaces: "Teacher/institute workspaces.",
  orgCodes: "Organization codes (institute join codes).",
  enrollment: "Student-side join + marketplace enrollment flows.",
  batches: "Batch CRUD + assignments.",
  questionBag: "Teacher Question Bag CRUD.",
  teacherTests: "Teacher test creation + assignment.",
  teacherRooms: "Teacher live rooms.",
  studyMaterials: "Teacher study material library.",
  teacherAnalytics: "Batch / student analytics for teachers.",
  ogcodePublishing: "OGCode publish + moderation surfaces.",
  documentImport: "Document import worker surfaces.",
  adminControlCenter: "Admin tooling itself — be careful.",
  paidEnrollment: "Marketplace payments + paid enrollments.",
};

export default async function AdminIncidentsPage() {
  const snapshot: Snapshot = await getIncidentSnapshot();

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Incident Controls</h1>
        <p className="text-sm text-muted-foreground">
          Emergency kill-switches, rate-limit modes, force-logout, and workspace close.
          Every action writes one app.audit_events row tagged entity_type &quot;incident&quot;.
        </p>
      </div>

      {!snapshot.redisConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-500">Redis is not configured</CardTitle>
            <CardDescription>
              Incident overrides apply only to this pod. Set UPSTASH_REDIS_REST_URL/TOKEN to
              propagate across the fleet.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rate-limit mode</CardTitle>
          <CardDescription>
            Current mode:{" "}
            <Badge variant={snapshot.rateLimitMode === "lockdown" ? "destructive" : "secondary"}>
              {snapshot.rateLimitMode}
            </Badge>
            {" "}— {RATE_LIMIT_MODE_DESCRIPTIONS[snapshot.rateLimitMode as RateLimitMode]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentControlForms.RateLimit current={snapshot.rateLimitMode as RateLimitMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature kill-switches</CardTitle>
          <CardDescription>
            Set a flag to &quot;off&quot; to refuse traffic for that surface with a 503. &quot;clear&quot; restores
            the env-driven default. Snapshot TTL: {snapshot.snapshotTtlMs}ms — changes propagate
            within that window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {Object.entries(FLAG_DESCRIPTIONS).map(([flag, description]) => (
              <li key={flag} className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{flag}</span>
                    <Badge variant={snapshot.flagOverrides[flag] === false ? "destructive" : snapshot.flagOverrides[flag] === true ? "default" : "outline"}>
                      {snapshot.flagOverrides[flag] === undefined ? "default" : snapshot.flagOverrides[flag] ? "forced on" : "killed"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <IncidentControlForms.KillSwitch flag={flag} current={snapshot.flagOverrides[flag]} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Force-logout user</CardTitle>
            <CardDescription>
              Bumps auth_token_version and revokes refresh sessions. The user&apos;s next request
              gets a 401.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncidentControlForms.ForceLogout />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Close workspace</CardTitle>
            <CardDescription>
              Terminal — sets status=closed. Use suspend/unsuspend for reversible holds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncidentControlForms.CloseWorkspace />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
