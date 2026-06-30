import { Sidebar } from "@/components/dashboard/Sidebar";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import { LiveCheckToggle } from "@/components/dashboard/LiveCheckToggle";
import { db } from "@/lib/db";
import type { LogStatus } from "@/types";

const PAGE_SIZE = 50;
const POLL_INTERVAL = parseInt(
  process.env.LIVE_CHECK_POLL_INTERVAL_SECONDS ?? "45",
  10
) * 1000;

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const [logs, total, stats] = await Promise.all([
    db.processLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.processLog.count(),
    db.processLog.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getCount = (s: LogStatus) =>
    stats.find((x) => x.status === s)?._count.id ?? 0;

  const totalProcessed = stats.reduce((sum, x) => sum + x._count.id, 0);
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
          total={totalProcessed}
          autoSent={autoSent}
          pendingReview={pendingReview}
          errors={errors}
        />

        <LiveCheckToggle pollIntervalMs={POLL_INTERVAL} />

        <ConversationTable
          logs={serializedLogs}
          page={page}
          totalPages={totalPages}
        />
      </main>
    </div>
  );
}
