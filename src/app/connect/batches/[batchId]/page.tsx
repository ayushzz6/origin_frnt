export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileIcon, ExternalLink, BookOpen } from "lucide-react";

import { BatchChat } from "@/components/batch/BatchChat";
import { getStudentBatchContext } from "@/server/workspaces/batch-messages-store";
import { getMaterialsVisibleToBatch } from "@/server/workspaces/study-materials-service";

import { gateConnectStudent } from "../../_gate";

type Props = {
  params: Promise<{ batchId: string }>;
};

export default async function StudentBatchPage({ params }: Props) {
  const user = await gateConnectStudent();
  const { batchId } = await params;

  const batch = await getStudentBatchContext(batchId, user.id);
  if (!batch) notFound();

  const materials = await getMaterialsVisibleToBatch(batch.workspaceId, batchId);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/connect" className="neu-inset rounded-full p-2 hover:opacity-80">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">{batch.batchName}</h1>
          {batch.subject && <p className="text-xs text-muted-foreground">{batch.subject}</p>}
        </div>
      </div>

      {/* Study materials shared with this batch */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-primary" /> Study materials
        </h2>
        {materials.length === 0 ? (
          <p className="text-xs text-muted-foreground neu-inset rounded-2xl p-4">
            No materials shared yet.
          </p>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => {
              const href = m.assets[0]?.publicUrl ?? null;
              const isLink = m.materialType === "link" || m.materialType === "video";
              return (
                <a
                  key={m.id}
                  href={href ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-3 rounded-2xl neu-inset hover:opacity-90 transition ${href ? "" : "pointer-events-none opacity-60"}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {isLink ? <ExternalLink className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.materialType.toUpperCase()} · {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* Batch chat */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold">Batch chat</h2>
        <BatchChat
          messagesUrl={`/api/connect/batches/${batchId}/messages`}
          currentUserId={user.id}
          mineRole="student"
        />
      </section>
    </div>
  );
}
