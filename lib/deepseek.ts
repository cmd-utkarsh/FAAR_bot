import type { DeepSeekResponse, FrontTemplate } from "@/types";

const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";

interface DeepSeekCompletionRequest {
  model: string;
  response_format: { type: "json_object" };
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  temperature: number;
}

function cleanJsonString(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export async function selectTemplate(
  emailBody: string,
  templates: FrontTemplate[],
  model: string = "deepseek-chat"
): Promise<DeepSeekResponse> {
  const templateDescriptions = templates
    .map(
      (t) =>
        `Template ID: ${t.id}\nName: ${t.name}\nSubject: ${t.subject}\nBody: ${t.body}\n---`
    )
    .join("\n");

  const systemPrompt = `You are a RoadReady customer support routing assistant. Your job is to read an inbound email and select the most appropriate response template from a provided list.

Return ONLY valid JSON in this format:
{
  "template_id": "rsp_xxxxx",
  "template_name": "Name of template",
  "confidence": 94,
  "reasoning": "Brief explanation of why this template matches"
}

Rules:
- confidence must be an integer between 0 and 100
- If no template is a good match, set template_id to "none" and confidence to 0
- Base your selection on the email's intent, not just keywords`;

  const userPrompt = `INBOUND EMAIL:\nSubject: (see conversation)\nBody:\n${emailBody}\n\nAVAILABLE TEMPLATES:\n${templateDescriptions}`;

  const requestBody: DeepSeekCompletionRequest = {
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  };

  const res = await fetch(DEEPSEEK_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      `DeepSeek API error ${res.status}: ${JSON.stringify(errorBody)}`
    );
  }

  const completion = await res.json();
  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek returned empty response content");
  }

  try {
    const cleaned = cleanJsonString(content);
    const parsed: DeepSeekResponse = JSON.parse(cleaned);

    if (
      typeof parsed.template_id !== "string" ||
      typeof parsed.confidence !== "number"
    ) {
      throw new Error("Invalid DeepSeek response structure");
    }

    return parsed;
  } catch (e) {
    throw new Error(
      `Failed to parse DeepSeek JSON response: ${(e as Error).message}\nRaw: ${content.slice(0, 500)}`
    );
  }
}
