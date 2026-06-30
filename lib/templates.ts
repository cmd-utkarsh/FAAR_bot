import { frontClient } from "./front";
import type { FrontTemplate } from "@/types";

let templateCache: {
  templates: FrontTemplate[];
  fetchedAt: number;
} | null = null;

const TTL_MS = 5 * 60 * 1000;

export async function getTemplates(): Promise<FrontTemplate[]> {
  const now = Date.now();
  if (templateCache && now - templateCache.fetchedAt < TTL_MS) {
    return templateCache.templates;
  }

  const { data } = await frontClient.listMessageTemplates();
  templateCache = {
    templates: data._results,
    fetchedAt: now,
  };

  return data._results;
}

export function resolveTemplateVariables(
  templateBody: string,
  context: { recipientName?: string; recipientHandle?: string; senderName?: string }
): string {
  return templateBody
    .replace(/\{\{recipient\.first_name\}\}/g, context.recipientName?.split(" ")[0] ?? "")
    .replace(/\{\{recipient\.full_name\}\}/g, context.recipientName ?? "")
    .replace(/\{\{recipient\.email\}\}/g, context.recipientHandle ?? "")
    .replace(/\{\{sender\.first_name\}\}/g, context.senderName?.split(" ")[0] ?? "")
    .replace(/\{\{sender\.full_name\}\}/g, context.senderName ?? "")
    .replace(/\{\{sender\.email\}\}/g, "")
    .replace(/\{\{[^}]+\}\}/g, "");
}

export function hasUnresolvedVariables(templateBody: string): boolean {
  return /\{\{[^}]+\}\}/.test(templateBody);
}

export function clearTemplateCache(): void {
  templateCache = null;
}
