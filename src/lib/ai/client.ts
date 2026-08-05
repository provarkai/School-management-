export function isAiConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export const ASSISTANT_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** OpenAI-style multimodal content part — the shape OpenRouter expects for
 * vision-capable models. Only used by the "scan a photo" one-shot calls
 * (src/lib/ai/vision.ts); the tool-calling assistants never send images. */
export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenRouterContentPart[] | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterResponse {
  choices: {
    finish_reason: string;
    message: OpenRouterMessage;
  }[];
  error?: { message: string };
}

/** Text-only call sites (the tool-calling assistants, draftText) never send
 * image content themselves, so a reply's content is always a plain string —
 * this just gives them a typed way to say so instead of each re-deriving it. */
export function contentText(content: OpenRouterMessage["content"]): string {
  return typeof content === "string" ? content : "";
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  tools: OpenRouterTool[]
): Promise<OpenRouterResponse> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://school-management-platform-one.vercel.app",
      "X-Title": "School Manager AI Assistant",
    },
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      messages,
      tools,
      max_tokens: 2048,
    }),
  });

  const data = (await res.json()) as OpenRouterResponse;
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenRouter request failed (${res.status})`);
  }
  return data;
}
