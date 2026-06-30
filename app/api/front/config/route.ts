import { NextResponse } from "next/server";
import { frontClient } from "@/lib/front";

export async function GET() {
  try {
    const [statusesResult, teammatesResult, templatesResult] =
      await Promise.allSettled([
        frontClient.getCompanyStatuses(),
        frontClient.getTeammates(),
        frontClient.listMessageTemplates(),
      ]);

    const statuses =
      statusesResult.status === "fulfilled"
        ? statusesResult.value.data._results
        : [];

    const teammates =
      teammatesResult.status === "fulfilled"
        ? teammatesResult.value.data._results
        : [];

    const frontOk = templatesResult.status === "fulfilled";
    const ticketingEnabled = statuses.length > 0;

    const currentWaitingStatusId = process.env.FRONT_WAITING_STATUS_ID ?? "";
    const currentAuthorTeammateId = process.env.FRONT_AUTHOR_TEAMMATE_ID ?? "";

    return NextResponse.json({
      frontConnected: frontOk,
      ticketingEnabled,
      statuses: statuses.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        isWaiting: s.category === "waiting",
      })),
      teammates: teammates.map((t) => ({
        id: t.id,
        email: t.email,
        name: `${t.first_name} ${t.last_name}`.trim(),
        isAvailable: t.is_available,
      })),
      currentWaitingStatusId,
      currentAuthorTeammateId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
