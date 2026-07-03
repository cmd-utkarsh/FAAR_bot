import type { DeepSeekResponse, FrontTemplate } from "@/types";

function cleanJsonString(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

const SYSTEM_PROMPT = `You are a RoadReady customer support routing assistant. Your job is to read an inbound email and select the most appropriate response template from a provided list.

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

function buildUserPrompt(emailBody: string, templates: FrontTemplate[]): string {
  const templateDescriptions = templates
    .map(
      (t) =>
        `Template ID: ${t.id}\nName: ${t.name}\nSubject: ${t.subject}\nBody: ${t.body}\n---`
    )
    .join("\n");
  return `INBOUND EMAIL:\nBody:\n${emailBody}\n\nAVAILABLE TEMPLATES:\n${templateDescriptions}`;
}

function parseResponse(content: string): DeepSeekResponse {
  const cleaned = cleanJsonString(content);
  const parsed = JSON.parse(cleaned);

  if (
    typeof parsed.template_id !== "string" ||
    typeof parsed.confidence !== "number"
  ) {
    throw new Error("Invalid LLM response structure");
  }

  return parsed as DeepSeekResponse;
}

async function callOpenAI(
  emailBody: string,
  templates: FrontTemplate[]
): Promise<DeepSeekResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(emailBody, templates) },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `OpenAI error ${res.status}: ${JSON.stringify(err)}`
    );
  }

  const completion = await res.json();
  const content = completion.choices?.[0]?.message?.content;

  if (!content) throw new Error("OpenAI returned empty response");

  return parseResponse(content);
}

async function callDeepSeek(
  emailBody: string,
  templates: FrontTemplate[]
): Promise<DeepSeekResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(emailBody, templates) },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `DeepSeek error ${res.status}: ${JSON.stringify(err)}`
    );
  }

  const completion = await res.json();
  const content = completion.choices?.[0]?.message?.content;

  if (!content) throw new Error("DeepSeek returned empty response");

  return parseResponse(content);
}

export async function selectTemplate(
  emailBody: string,
  templates: FrontTemplate[]
): Promise<DeepSeekResponse> {
  const primary = process.env.LLM_PRIMARY ?? "openai";

  if (primary === "openai") {
    try {
      return await callOpenAI(emailBody, templates);
    } catch (openaiErr) {
      console.warn(
        "OpenAI call failed, falling back to DeepSeek:",
        (openaiErr as Error).message
      );
      try {
        return await callDeepSeek(emailBody, templates);
      } catch (deepseekErr) {
        throw new Error(
          `Both LLMs failed. OpenAI: ${(openaiErr as Error).message}. DeepSeek: ${(deepseekErr as Error).message}`
        );
      }
    }
  }

  try {
    return await callDeepSeek(emailBody, templates);
  } catch (deepseekErr) {
    console.warn(
      "DeepSeek call failed, falling back to OpenAI:",
      (deepseekErr as Error).message
    );
    return await callOpenAI(emailBody, templates);
  }
}
