import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

import { requireUserFromRequest } from "@/server/auth";
import { submitLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import {
  type CustomTestPayload,
  checkGeneratedDppQuestion,
  createCustomTest,
  getGeneratedDppDetail,
  getChallengeOfTheDay,
  getFocusAreas,
  getOgcodeLeaderboard,
  listOgcodeQuestionChapters,
  listOgcodeQuestionPage,
  listOgcodeQuestions,
  listGeneratedDpps,
  getOgcodeSubjectRanks,
  getOgcodeUserStats,
  getPracticeQuestionDetail,
  getSingleResultAnalysis,
  getSingleResult,
  getTestDetail,
  listTestPreviews,
  listPracticeQuestions,
  listTestResults,
  type PracticeSubmissionPayload,
  type DppQuestionCheckPayload,
  submitGeneratedDpp,
  submitPracticeQuestion,
  type TestSubmissionPayload,
  submitTest,
  type UpdateOgcodeLocationPayload,
  updateOgcodeLocation,
} from "@/server/assessments";
import { badRequest, created, forbidden, getSlugSegments, methodNotAllowed, notFound, ok, parseJsonBody, unauthorized } from "@/server/http";
import { readStoreAsync, withStoreAsync } from "@/server/store";

function revalidateUserProgress(userId: string) {
  revalidateTag("milestones", "max");
  revalidateTag("progress", "max");
  revalidateTag(`progress-user:${userId}`, "max");
  revalidateTag("leaderboard", "max");
  revalidateTag("auth-user", "max");
  revalidateTag(`user:${userId}`, "max");
}

function revalidateTestMutation(userId: string, testId?: string) {
  revalidateTag("tests", "max");
  if (testId) {
    revalidateTag(`test:${testId}`, "max");
  }
  revalidateUserProgress(userId);
  revalidateTag("ogcode-catalog", "max");
}

function revalidateOgcodeMutation(userId: string, questionId?: string) {
  revalidateUserProgress(userId);
  revalidateTag("ogcode-catalog", "max");
  revalidateTag(`ogcode-user:${userId}`, "max");
  revalidateTag("user-stats", "max");
  if (questionId) {
    revalidateTag(`ogcode-question:${questionId}`, "max");
  }
}

async function authUser(request: Request) {
  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) {
    return null;
  }
  return { store, user };
}

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authUser(request);
  if (!auth) {
    return unauthorized();
  }

  const limited = await checkRateLimit(generalLimiter, auth.user.id);
  if (limited) return limited;

  const { store, user } = auth;
  const params = await context.params;
  const slug = getSlugSegments(params);
  const [root, first, second] = slug;

  try {
    if (root === "tests" && !first) {
      return ok(await listTestPreviews(store, user));
    }

    if (root === "tests" && first && !second) {
      return ok(await getTestDetail(store, user, first));
    }

    if (root === "tests" && first && second === "results") {
      return ok(await listTestResults(store, user, first));
    }

    if (root === "results" && first && second === "analysis") {
      return ok(await getSingleResultAnalysis(store, user, first));
    }

    if (root === "results" && first) {
      return ok(await getSingleResult(store, user, first));
    }

    if (root === "dpps" && !first) {
      return ok(await listGeneratedDpps(store, user));
    }

    if (root === "dpps" && first && !second) {
      return ok(await getGeneratedDppDetail(store, user, first));
    }

    if (root === "practice" && !first) {
      const url = new URL(request.url);
      return ok(
        listPracticeQuestions(store, user, {
          subject: url.searchParams.get("subject"),
          difficulty: url.searchParams.get("difficulty"),
          type: url.searchParams.get("type"),
        }),
      );
    }

    if (root === "practice" && first && !second) {
      return ok(await getPracticeQuestionDetail(store, user, first));
    }

    if (root === "ogcode" && first === "questions") {
      const url = new URL(request.url);
      const limit = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      // Read repeated ?chapters=… params. Chapter names contain commas,
      // so we can't use a CSV separator here.
      const chapters = url.searchParams
        .getAll("chapters")
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (limit) {
        return ok(
          await listOgcodeQuestionPage(store, user, {
            subject: url.searchParams.get("subject"),
            difficulty: url.searchParams.get("difficulty"),
            type: url.searchParams.get("type"),
            search: url.searchParams.get("search"),
            status: url.searchParams.get("status") as "solved" | "unsolved" | null,
            chapters,
            limit: Number(limit),
            offset: offset ? Number(offset) : 0,
          }),
        );
      }

      return ok(
        await listOgcodeQuestions(store, user, {
          subject: url.searchParams.get("subject"),
          difficulty: url.searchParams.get("difficulty"),
          type: url.searchParams.get("type"),
        }),
      );
    }

    if (root === "ogcode" && first === "challenge") {
      return ok(await getChallengeOfTheDay(store, user));
    }

    if (root === "ogcode" && first === "chapters") {
      const url = new URL(request.url);
      const subject = url.searchParams.get("subject");
      return ok(subject ? await listOgcodeQuestionChapters(store, user, subject) : []);
    }

    if (root === "ogcode" && first === "user-stats") {
      return ok(await getOgcodeUserStats(store, user));
    }

    if (root === "ogcode" && first === "leaderboard" && second === "subjects") {
      return ok(await getOgcodeSubjectRanks(store, user));
    }

    if (root === "ogcode" && first === "stats") {
      return ok(await getOgcodeSubjectRanks(store, user));
    }

    if (root === "ogcode" && first === "leaderboard") {
      const url = new URL(request.url);
      return ok(await getOgcodeLeaderboard(
        store,
        user,
        url.searchParams.get("subject"),
        url.searchParams.get("location")
      ));
    }

    if (root === "focus-areas") {
      return ok(await getFocusAreas(store, user));
    }
  } catch (error) {
    if ((error as { status?: number })?.status === 403) {
      return forbidden(error instanceof Error ? error.message : "Forbidden.");
    }
    return notFound(error instanceof Error ? error.message : "Not found.");
  }

  return notFound();
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const slug = getSlugSegments(params);
  const [root, first, second] = slug;

  const auth = await authUser(request);
  if (!auth) {
    return unauthorized();
  }

  const isSubmit = second === "submit" || (root === "ogcode" && first === "location");
  const limited = await checkRateLimit(isSubmit ? submitLimiter : generalLimiter, auth.user.id);
  if (limited) return limited;

  try {
    if (root === "tests" && first === "custom") {
      const body = await parseJsonBody<CustomTestPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return createCustomTest(store, user, body);
      });
      revalidateTag("tests", "max");
      revalidateTag(`progress-user:${auth.user.id}`, "max");
      return created(response);
    }

    if (root === "tests" && first && second === "submit") {
      const body = await parseJsonBody<TestSubmissionPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return submitTest(store, user, first, body);
      });
      revalidateTestMutation(auth.user.id, first);
      return created(response);
    }

    if (root === "dpps" && first && second === "submit") {
      const body = await parseJsonBody<TestSubmissionPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return submitGeneratedDpp(store, user, first, body);
      });
      revalidateTestMutation(auth.user.id);
      return created(response);
    }

    if (root === "dpps" && first && second === "check") {
      const body = await parseJsonBody<DppQuestionCheckPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return checkGeneratedDppQuestion(store, user, first, body);
      });
      return ok(response);
    }

    if (root === "practice" && first && second === "submit") {
      const body = await parseJsonBody<PracticeSubmissionPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return submitPracticeQuestion(store, user, first, body);
      });
      revalidateOgcodeMutation(auth.user.id, first);
      return ok(response);
    }

    if (root === "ogcode" && first === "location") {
      const body = await parseJsonBody<UpdateOgcodeLocationPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return updateOgcodeLocation(store, user, body);
      });
      revalidateTag("leaderboard", "max");
      revalidateTag(`progress-user:${auth.user.id}`, "max");
      return ok(response);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not provided")) {
      return unauthorized(error.message);
    }
    if ((error as { status?: number })?.status === 403) {
      return forbidden(error instanceof Error ? error.message : "Forbidden.");
    }
    return badRequest(error instanceof Error ? error.message : "Invalid request.");
  }

  return methodNotAllowed();
}
