import { NextResponse } from "next/server";
import { processConversation } from "@/lib/pipeline";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conversationIds, dryRun } = body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: "conversationIds array is required" },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const id of conversationIds) {
      try {
        const result = await processConversation(id, dryRun ?? false);
        results.push(result);
      } catch (e) {
        errors.push({ conversationId: id, error: (e as Error).message });
      }
    }

    return NextResponse.json({
      total: conversationIds.length,
      processed: results.length,
      errors: errors.length,
      results,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "25", 10);
    const skip = (page - 1) * pageSize;

    const [logs, total, stats] = await Promise.all([
      db.processLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.processLog.count(),
      db.processLog.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      logs,
      stats,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
