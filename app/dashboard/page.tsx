import { Sidebar } from "@/components/dashboard/Sidebar";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import { LiveCheckToggle } from "@/components/dashboard/LiveCheckToggle";
import { db } from "@/lib/db";
import type { LogStatus } from "@/types";

const POLL_INTERVAL = parseInt(
  process.env.LIVE_CHECK_POLL_INTERVAL_SECONDS ?? "45",
  10
) * 1000;

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [logs, stats] = await Promise.all([
    db.processLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.processLog.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const getCount = (s: LogStatus) =>
    stats.find((x) => x.status === s)?._count.id ?? 0;

  const total = stats.reduce((sum, x) => sum + x._count.id, 0);
  const autoSent = getCount("AUTO_SENT") + getCount("MANUALLY_SENT");
  const pendingReview = getCount("MANUAL_REVIEW");
  const errors = getCount("ERROR");

  const serializedLogs = logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6">
        <StatsBar
          total={total}
          autoSent={autoSent}
          pendingReview={pendingReview}
          errors={errors}
        />

        <LiveCheckToggle pollIntervalMs={POLL_INTERVAL} />

        <ConversationTable logs={serializedLogs} />
      </main>
    </div>
  );
}
