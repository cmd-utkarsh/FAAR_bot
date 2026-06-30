import { NextResponse } from "next/server";
import { frontClient } from "@/lib/front";
import { processConversation } from "@/lib/pipeline";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dryRun, maxConversations } = body;

    const isDryRun = dryRun !== false;
    const max = maxConversations ?? 500;

    let fetched = 0;
    let processed = 0;
    let errors = 0;
    let nextPageUrl: string | undefined;

    const params = new URLSearchParams();
    params.append("q[statuses]", "unassigned");
    params.append("q[statuses]", "assigned");
    params.append("limit", "100");

    while (fetched < max) {
      const { data } = await frontClient.listConversations(
        nextPageUrl ? {} : params,
        nextPageUrl
      );

      const conversations = data._results;
      fetched += conversations.length;

      for (const conv of conversations) {
        try {
          const already = await db.processLog.findUnique({
            where: { conversationId: conv.id },
            select: { status: true },
          });

          if (already && already.status === "AUTO_SENT") {
            continue;
          }

          await processConversation(conv.id, isDryRun);
          processed++;
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
