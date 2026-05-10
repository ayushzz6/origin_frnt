import type { NextRequest } from "next/server";

import { badRequest, ok, unauthorized } from "@/server/http";
import { drainAnalysisJobs } from "@/server/analysis-jobs";
import { isBearerTokenAuthorized } from "@/server/service-auth";

async function runWorker(request: NextRequest) {
  if (!isBearerTokenAuthorized(request, "INTERNAL_CRON_TOKEN")) {
    return unauthorized("Invalid internal worker token.");
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 5);
  try {
    return ok(await drainAnalysisJobs(limit));
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to drain analysis jobs.");
  }
}

export async function POST(request: NextRequest) {
  return runWorker(request);
}

export async function GET(request: NextRequest) {
  return runWorker(request);
}
