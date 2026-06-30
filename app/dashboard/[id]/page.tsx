import { Sidebar } from "@/components/dashboard/Sidebar";
import { db } from "@/lib/db";
import { frontClient } from "@/lib/front";
import { ConversationDetail } from "./ConversationDetail";
import { notFound } from "next/navigation";
import type { FrontConversation, FrontMessage, FrontTemplate } from "@/types";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const log = await db.processLog.findUnique({
    where: { conversationId: id },
  });

  if (!log) {
    notFound();
  }

  let conversation: FrontConversation | null = null;
  let messages: FrontMessage[] | null = null;
  let templates: FrontTemplate[] = [];
  let error: string | undefined;

  try {
    const [convResult, msgResult, tmplResult] = await Promise.allSettled([
      frontClient.getConversation(id),
      frontClient.getMessages(id),
      frontClient.listMessageTemplates(),
    ]);

    conversation =
      convResult.status === "fulfilled" ? (convResult.value.data as FrontConversation) : null;
    messages =
      msgResult.status === "fulfilled"
        ? (msgResult.value.data._results as FrontMessage[])
        : null;
    templates =
      tmplResult.status === "fulfilled"
        ? (tmplResult.value.data._results as FrontTemplate[])
        : [];

    if (!conversation || !messages) {
      error = "Failed to fetch conversation or messages from Front API";
    }
  } catch (e) {
    error = (e as Error).message;
  }

  const lastInbound = messages?.find((m) => m.is_inbound === true);
  const matchedTemplate = templates?.find((t) => t.id === log.templateId);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">
        <ConversationDetail
          conversationId={id}
          log={log}
          conversation={conversation}
          lastInbound={lastInbound ?? null}
          matchedTemplate={matchedTemplate ?? null}
          error={error}
        />
      </main>
    </div>
  );
}
