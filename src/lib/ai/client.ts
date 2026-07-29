export function isAiConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export const ASSISTANT_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
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
