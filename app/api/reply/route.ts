import { NextResponse } from "next/server";
import { frontClient, extractReplyTo } from "@/lib/front";
import { resolveTemplateVariables } from "@/lib/templates";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const log = await db.processLog.findUnique({
      where: { conversationId },
    });

    if (!log) {
      return NextResponse.json(
        { error: "No ProcessLog entry found for this conversation" },
        { status: 404 }
      );
    }

    const { data: messagesData } = await frontClient.getMessages(conversationId);
    const lastInbound = messagesData._results.find((m) => m.is_inbound === true);

    if (!lastInbound) {
      return NextResponse.json(
        { error: "No inbound message found in conversation" },
        { status: 404 }
      );
    }

    const { data: conversation } = await frontClient.getConversation(conversationId);
    const { data: templatesData } = await frontClient.listMessageTemplates();
    const template = templatesData._results.find((t) => t.id === log.templateId);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const recipient = conversation.recipient;
    const body = resolveTemplateVariables(template.body, {
      recipientName: recipient?.name,
      recipientHandle: recipient?.handle,
      senderName: lastInbound.author?.name,
    });

    const replyTo = extractReplyTo(lastInbound, conversation);

    const authorId = process.env.FRONT_AUTHOR_TEAMMATE_ID;
    const sendPayload = {
      body,
      to: replyTo,
      author_id: authorId || undefined,
      options: { archive: false },
    };

    let sendResult;
    try {
      sendResult = (
        await frontClient.sendReply(conversationId, sendPayload)
      ).data;
    } catch (e) {
      if (authorId && (e as Error).message.includes("403")) {
        const { author_id: _, ...fallbackPayload } = sendPayload;
        sendResult = (
          await frontClient.sendReply(conversationId, fallbackPayload)
        ).data;
      } else {
        throw e;
      }
    }

    let statusIdApplied: string | undefined;
    const waitingStatusId = process.env.FRONT_WAITING_STATUS_ID;
    if (waitingStatusId) {
      await frontClient.updateConversationStatus(conversationId, {
        status_id: waitingStatusId,
      });
      statusIdApplied = waitingStatusId;
    }

    await db.processLog.update({
      where: { conversationId },
      data: {
        status: "MANUALLY_SENT",
        messageUid: sendResult.message_uid,
        statusIdApplied,
        replySentAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Reply sent successfully",
      messageUid: sendResult.message_uid,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
