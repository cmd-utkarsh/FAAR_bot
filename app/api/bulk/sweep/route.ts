import { NextResponse } from "next/server";
import { frontClient } from "@/lib/front";
import { processConversation } from "@/lib/pipeline";
import { db } from "@/lib/db";
import { RateLimiter } from "@/lib/rate-limiter";

const BATCH_SIZE = 100;
const DEFAULT_MAX = 500;
const DEFAULT_RPM = 100;

function getRateLimiter(): RateLimiter {
  const rpm = parseInt(
    process.env.FRONT_PLAN_RATE_LIMIT_RPM ?? String(DEFAULT_RPM),
    10
  );
  const safeRpm = Math.floor(rpm * 0.8);
  return new RateLimiter(safeRpm);
}

function buildInitialParams(): URLSearchParams {
  const params = new URLSearchParams();
  params.append("q[statuses]", "unassigned");
  params.append("q[statuses]", "assigned");
  params.append("limit", String(BATCH_SIZE));
  return params;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dryRun, maxConversations } = body;

    const isDryRun = dryRun !== false;
    const max = maxConversations ?? DEFAULT_MAX;

    const rl = getRateLimiter();
    const params = buildInitialParams();

    let fetched = 0;
    let processed = 0;
    let autoSent = 0;
    let errors = 0;
    let nextPageUrl: string | undefined;

    while (fetched < max) {
      await rl.acquire();
      const { data, rateLimit } = nextPageUrl
        ? await frontClient.listConversations({}, nextPageUrl)
        : await frontClient.listConversations(params);
      rl.updateFromHeaders(rateLimit.remaining, rateLimit.reset, rateLimit.limit);

      const conversations = data._results;
      fetched += conversations.length;

      const AUTO_REPLY_PATTERNS = [/^Automatic reply:/i];

      for (const conv of conversations) {
        if (fetched > max) break;

        if (AUTO_REPLY_PATTERNS.some((p) => p.test(conv.subject ?? ""))) {
          continue;
        }

        try {
          const already = await db.processLog.findUnique({
            where: { conversationId: conv.id },
            select: { status: true },
          });

          if (already && already.status === "AUTO_SENT") {
            continue;
          }

          const result = await processConversation(conv.id, isDryRun);
          processed++;
          if (result.status === "AUTO_SENT") {
            autoSent++;
          }
        } catch (e) {
          errors++;
          console.error(`Sweep error for ${conv.id}:`, (e as Error).message);
        }
      }

      nextPageUrl = data._pagination.next;
      if (!nextPageUrl) break;

      if (fetched >= max) break;
    }

    return NextResponse.json({
      fetched,
      processed,
      autoSent,
      errors,
      dryRun: isDryRun,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
