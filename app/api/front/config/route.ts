import { NextResponse } from "next/server";

const BASE_URL = "https://api2.frontapp.com";

function headers() {
  return {
    Authorization: `Bearer ${process.env.FRONT_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function GET() {
  try {
    const [statusesRes, teammatesRes, templatesRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/company/statuses`, { headers: headers() }),
      fetch(`${BASE_URL}/teammates`, { headers: headers() }),
      fetch(`${BASE_URL}/message_templates`, { headers: headers() }),
    ]);

    const frontOk = templatesRes.status === "fulfilled" && templatesRes.value.ok;

    let ticketingEnabled = false;
    let statuses: Array<{
      id: string;
      name: string;
      category: string;
      isWaiting: boolean;
    }> = [];

    if (statusesRes.status === "fulfilled") {
      const res = statusesRes.value;
      if (res.ok) {
        ticketingEnabled = true;
        const data = await res.json();
        statuses = (data._results ?? []).map(
          (s: { id: string; name: string; category: string }) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            isWaiting: s.category === "waiting",
          })
        );
      }
    }

    let teammates: Array<{
      id: string;
      email: string;
      name: string;
      isAvailable: boolean;
    }> = [];

    if (teammatesRes.status === "fulfilled" && teammatesRes.value.ok) {
      const data = await teammatesRes.value.json();
      teammates = (data._results ?? []).map(
        (t: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          is_available: boolean;
        }) => ({
          id: t.id,
          email: t.email,
          name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim(),
          isAvailable: t.is_available,
        })
      );
    }

    const currentWaitingStatusId = process.env.FRONT_WAITING_STATUS_ID ?? "";
    const currentAuthorTeammateId = process.env.FRONT_AUTHOR_TEAMMATE_ID ?? "";

    return NextResponse.json({
      frontConnected: frontOk,
      ticketingEnabled,
      statuses,
      teammates,
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
