export const dynamic = "force-dynamic";

/**
 * Phase 12 — student-facing marketplace landing.
 *
 * Lists verified-then-recent institutes. Filterable by subject + city
 * via query string; clicking through opens the institute profile with
 * its active offerings.
 */

import Link from "next/link";

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
    <div className="min-h-screen neu-surface text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-primary mb-1">Browse</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Market<span className="text-primary">place</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse verified institutes on ORIGIN. Pick a course offering to enroll directly.
          </p>
        </div>

        {/* Filters */}
        <div className="neu-raised rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Filter</p>
          <form className="flex flex-wrap gap-3" method="get">
            <div className="neu-inset rounded-xl flex-1 min-w-[160px]">
              <input
                name="subject"
                placeholder="Subject (e.g. Physics)"
                defaultValue={sp.subject ?? ""}
                className="w-full bg-transparent outline-none text-sm px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="neu-inset rounded-xl flex-1 min-w-[160px]">
              <input
                name="city"
                placeholder="City (e.g. Bengaluru)"
                defaultValue={sp.city ?? ""}
                className="w-full bg-transparent outline-none text-sm px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-bold shadow-[3px_3px_8px_hsl(var(--neu-shadow))] hover:-translate-y-0.5 transition-all"
            >
              Apply
            </button>
          </form>
        </div>

        {institutes.length === 0 ? (
          <div className="neu-inset rounded-2xl p-10 text-center">
            <p className="font-bold text-foreground">No matching institutes</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try removing some filters, or check back as more institutes onboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {institutes.map((inst) => (
              <div key={inst.workspaceId} className="neu-raised rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-black text-foreground truncate">{inst.displayName}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[inst.city, inst.state, inst.country].filter(Boolean).join(", ") || "Online"}
                    </p>
                  </div>
                  {inst.verified && (
                    <span className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                      Verified
                    </span>
                  )}
                </div>

                {inst.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {inst.subjects.slice(0, 6).map((s) => (
                      <span key={s} className="neu-inset rounded-full px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {inst.studentCount} students · {inst.batchCount} batches
                </p>

                <Link
                  href={`/marketplace/institutes/${inst.workspaceId}`}
                  className="mt-auto w-full block text-center bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold shadow-[3px_3px_8px_hsl(var(--neu-shadow))] hover:-translate-y-0.5 transition-all"
                >
                  View profile
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
