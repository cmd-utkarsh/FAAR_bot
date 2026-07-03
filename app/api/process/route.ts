import { NextResponse } from "next/server";
import { processConversation } from "@/lib/pipeline";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conversationId, dryRun } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const already = await db.processLog.findUnique({
      where: { conversationId },
    });

    if (already && already.status === "AUTO_SENT") {
      return NextResponse.json({
        message: "Already processed and auto-sent",
        result: already,
      });
    }

    const result = await processConversation(conversationId, dryRun ?? false);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
