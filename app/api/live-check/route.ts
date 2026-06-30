import { NextResponse } from "next/server";
import { frontClient } from "@/lib/front";
import { processConversation } from "@/lib/pipeline";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";

    const existingIds = new Set(
      (
        await db.processLog.findMany({
          select: { conversationId: true },
        })
      ).map((l) => l.conversationId)
    );

    const liveCheckParams = new URLSearchParams();
    liveCheckParams.append("q[statuses]", "unassigned");
    liveCheckParams.append("q[statuses]", "assigned");
    liveCheckParams.append("limit", "25");

    const { data } = await frontClient.listConversations(liveCheckParams);

    const newConversations = data._results.filter(
      (c) => !existingIds.has(c.id)
    );

    let sent = 0;
    let flagged = 0;

    for (const conv of newConversations) {
      const result = await processConversation(conv.id, dryRun);
      if (result.status === "AUTO_SENT") {
        sent++;
      } else {
        flagged++;
      }
    }

    return NextResponse.json({
      checked: data._results.length,
      new: newConversations.length,
      sent,
      flagged,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
