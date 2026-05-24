/**
 * POST /api/admin/incidents/[action] — apply an incident control.
 *
 * action ∈ { kill_switch, force_logout, rate_limit, close_workspace }
 *
 * Each action records its own audit_events row tagged entityType
 * "incident" so the on-call timeline can be reconstructed from
 * /api/admin/audit-events alone.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import {
  applyCloseWorkspace,
  applyForceLogout,
  applyKillSwitch,
  applyRateLimitMode,
} from "@/server/incidents-service";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "@/app/api/teacher/_utils";

const FLAG_KEYS = [
  "workspaces",
  "orgCodes",
  "enrollment",
  "batches",
  "questionBag",
  "teacherTests",
  "teacherRooms",
  "studyMaterials",
  "teacherAnalytics",
  "ogcodePublishing",
  "documentImport",
  "adminControlCenter",
  "paidEnrollment",
] as const;

const RATE_LIMIT_MODES = ["relaxed", "normal", "strict", "lockdown"] as const;

const killSwitchSchema = z.object({
  flag: z.enum(FLAG_KEYS),
  value: z.enum(["on", "off", "clear"]),
  reason: z.string().max(500).nullable().optional(),
});

const forceLogoutSchema = z.object({
  userId: z.string().min(1).max(64),
  reason: z.string().max(500).nullable().optional(),
});

const rateLimitSchema = z.object({
  mode: z.enum(RATE_LIMIT_MODES),
  reason: z.string().max(500).nullable().optional(),
});

const closeWorkspaceSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  reason: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const auth = await requireRole(request, ["admin"]);
    const { action } = await context.params;
    const body = await parseJsonBody(request);
    const requestId = requestIdOf(request);

    switch (action) {
      case "kill_switch": {
        const parsed = killSwitchSchema.parse(body);
        await applyKillSwitch({
          adminUserId: auth.userId,
          requestId,
          flag: parsed.flag,
          value: parsed.value,
          reason: parsed.reason ?? null,
        });
        return teacherJson({ ok: true, action, flag: parsed.flag, value: parsed.value });
      }
      case "force_logout": {
        const parsed = forceLogoutSchema.parse(body);
        const result = await applyForceLogout({
          adminUserId: auth.userId,
          requestId,
          targetUserId: parsed.userId,
          reason: parsed.reason ?? null,
        });
        if (!result.found) {
          return teacherJson(
            { ok: false, action, detail: "User not found." },
            { status: 404 },
          );
        }
        return teacherJson({ ok: true, action, userId: parsed.userId });
      }
      case "rate_limit": {
        const parsed = rateLimitSchema.parse(body);
        await applyRateLimitMode({
          adminUserId: auth.userId,
          requestId,
          mode: parsed.mode,
          reason: parsed.reason ?? null,
        });
        return teacherJson({ ok: true, action, mode: parsed.mode });
      }
      case "close_workspace": {
        const parsed = closeWorkspaceSchema.parse(body);
        const result = await applyCloseWorkspace({
          adminUserId: auth.userId,
          requestId,
          workspaceId: parsed.workspaceId,
          reason: parsed.reason ?? null,
        });
        return teacherJson({ ok: true, action, ...result });
      }
      default:
        return teacherJson(
          { detail: `Unknown incident action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    return handleTeacherError(error);
  }
}
