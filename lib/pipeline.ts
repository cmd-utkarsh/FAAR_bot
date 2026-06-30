import { frontClient, extractReplyTo } from "./front";
import { selectTemplate } from "./deepseek";
import { getTemplates, resolveTemplateVariables } from "./templates";
import { db } from "./db";
import { RateLimiter } from "./rate-limiter";
import type { ProcessResult, LogStatus } from "@/types";

const DEFAULT_RPM = 100;

const rateLimiters = new Map<string, RateLimiter>();

function getRateLimiter(key: string): RateLimiter {
  if (!rateLimiters.has(key)) {
    const rpm = parseInt(
      process.env.FRONT_PLAN_RATE_LIMIT_RPM ?? String(DEFAULT_RPM),
      10
    );
    const safeRpm = Math.floor(rpm * 0.8);
    rateLimiters.set(key, new RateLimiter(safeRpm));
  }
  return rateLimiters.get(key)!;
}

async function withRateLimit<T>(
  fn: () => Promise<{ data: T; rateLimit: { remaining: number; reset: number; limit: number } }>
): Promise<T> {
  const rl = getRateLimiter("front");
  await rl.acquire();
  const result = await fn();
  rl.updateFromHeaders(
    result.rateLimit.remaining,
    result.rateLimit.reset,
    result.rateLimit.limit
  );
  return result.data;
}

export async function processConversation(
  conversationId: string,
  dryRun = false
): Promise<ProcessResult> {
  const messagesData = await withRateLimit(() =>
    frontClient.getMessages(conversationId)
  );

  const allMessages = messagesData._results;
  const lastInbound = allMessages.find((m) => m.is_inbound === true);

  if (!lastInbound) {
    const skipped: ProcessResult = {
      conversationId,
      emailSnippet: "",
      selectedTemplate: "",
      templateId: "",
      confidence: 0,
      reasoning: "No inbound message found",
      status: "SKIPPED",
    };
    await logResult(skipped);
    return skipped;
  }

  const conversation = await withRateLimit(() =>
    frontClient.getConversation(conversationId)
  );

  const templates = await getTemplates();

  let deepSeekResult;
  try {
    deepSeekResult = await selectTemplate(lastInbound.body ?? lastInbound.text, templates);
  } catch {
    const errorResult: ProcessResult = {
      conversationId,
      subjectLine: conversation.subject,
      emailSnippet: (lastInbound.body ?? lastInbound.text).slice(0, 500),
      selectedTemplate: "",
      templateId: "",
      confidence: 0,
      reasoning: "DeepSeek API error — routed to manual review",
      status: "ERROR",
    };
    await logResult(errorResult);
    return errorResult;
  }

  const threshold = parseInt(
    process.env.CONFIDENCE_THRESHOLD ?? "85",
    10
  );

  let messageUid: string | undefined;
  let statusIdApplied: string | undefined;

  if (!dryRun && deepSeekResult.confidence >= threshold && deepSeekResult.template_id !== "none") {
    const template = templates.find((t) => t.id === deepSeekResult.template_id);
    if (template) {
      const recipient = conversation.recipient;
      const body = resolveTemplateVariables(template.body, {
        recipientName: recipient?.name,
        recipientHandle: recipient?.handle,
        senderName: lastInbound.author?.name,
      });

      const replyTo = extractReplyTo(lastInbound, conversation);

      let sendResult;
      const authorId = process.env.FRONT_AUTHOR_TEAMMATE_ID;
      const sendPayload = {
        body,
        to: replyTo,
        author_id: authorId || undefined,
        options: { archive: false },
      };

      try {
        sendResult = await withRateLimit(() =>
          frontClient.sendReply(conversationId, sendPayload)
        );
      } catch (e) {
        if (authorId && (e as Error).message.includes("403")) {
          const { author_id: _, ...fallbackPayload } = sendPayload;
          sendResult = await withRateLimit(() =>
            frontClient.sendReply(conversationId, fallbackPayload)
          );
        } else {
          throw e;
        }
      }

      messageUid = sendResult.message_uid;

      const waitingStatusId = process.env.FRONT_WAITING_STATUS_ID;
      if (waitingStatusId) {
        await withRateLimit(() =>
          frontClient.updateConversationStatus(conversationId, {
            status_id: waitingStatusId,
          })
        );
        statusIdApplied = waitingStatusId;
      }
    }
  }

  const status: LogStatus = dryRun
    ? "MANUAL_REVIEW"
    : deepSeekResult.confidence >= threshold && deepSeekResult.template_id !== "none"
      ? "AUTO_SENT"
      : "MANUAL_REVIEW";

  const result: ProcessResult = {
    conversationId,
    subjectLine: conversation.subject,
    emailSnippet: (lastInbound.body ?? lastInbound.text).slice(0, 500),
    selectedTemplate: deepSeekResult.template_name,
    templateId: deepSeekResult.template_id,
    confidence: deepSeekResult.confidence,
    reasoning: deepSeekResult.reasoning,
    messageUid,
    statusIdApplied,
    status,
    replySentAt: status === "AUTO_SENT" ? new Date() : undefined,
  };

  await logResult(result);
  return result;
}

async function logResult(result: ProcessResult): Promise<void> {
  await db.processLog.upsert({
    where: { conversationId: result.conversationId },
    create: {
      conversationId: result.conversationId,
      subjectLine: result.subjectLine,
      emailSnippet: result.emailSnippet,
      selectedTemplate: result.selectedTemplate,
      templateId: result.templateId,
      confidence: result.confidence,
      reasoning: result.reasoning,
      messageUid: result.messageUid,
      statusIdApplied: result.statusIdApplied,
      status: result.status,
      replySentAt: result.replySentAt,
    },
    update: {
      subjectLine: result.subjectLine,
      emailSnippet: result.emailSnippet,
      selectedTemplate: result.selectedTemplate,
      templateId: result.templateId,
      confidence: result.confidence,
      reasoning: result.reasoning,
      messageUid: result.messageUid,
      statusIdApplied: result.statusIdApplied,
      status: result.status,
      replySentAt: result.replySentAt,
    },
  });
}

export async function processConversationsBatch(
  conversationIds: string[],
  dryRun = false
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  for (const id of conversationIds) {
    const result = await processConversation(id, dryRun);
    results.push(result);
  }
  return results;
}
