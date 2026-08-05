"use server";

import { requireParent } from "@/lib/current-parent";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter, isAiConfigured, type OpenRouterMessage } from "@/lib/ai/client";
import { PARENT_ASSISTANT_TOOLS, runParentAssistantTool } from "@/lib/ai/parentTools";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskAssistantResult {
  reply: string;
  error?: string;
}

const MAX_TOOL_ITERATIONS = 5;
const DAILY_MESSAGE_LIMIT = 200;
const MAX_HISTORY_TURNS = 20;

export async function askParentAssistant(
  history: ChatTurn[],
  message: string
): Promise<AskAssistantResult> {
  const parent = await requireParent();

  if (!isAiConfigured()) {
    return {
      reply:
        "The AI Assistant needs an OPENROUTER_API_KEY configured on the server before it can answer questions. Ask the school to contact whoever set up their School Manager account.",
    };
  }

  const supabase = await createClient();

  const { data: usageCount } = await supabase.rpc("increment_parent_assistant_usage");
  if ((usageCount ?? 0) > DAILY_MESSAGE_LIMIT) {
    return {
      reply: "You've reached today's message limit for the AI Assistant. It resets at midnight.",
    };
  }

  const recentHistory = history.slice(-MAX_HISTORY_TURNS);

  const childNames = parent.children.map((c) => c.full_name).join(", ") || "no linked children yet";
  const systemPrompt = `You are the AI Assistant inside a school's parent portal, helping ${parent.parent.name}, a parent whose children are: ${childNames}.

Answer questions about your child's/children's attendance, fees, and results using the provided tools — never guess or make up numbers. If a tool returns no data, say so plainly rather than inventing an answer. Keep answers short, warm, and direct. You cannot take actions outside these tools — you cannot make payments, and you cannot message the school yourself.`;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((h) => ({ role: h.role, content: h.content }) as OpenRouterMessage),
    { role: "user", content: message },
  ];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await callOpenRouter(messages, PARENT_ASSISTANT_TOOLS);
      const choice = response.choices[0];
      if (!choice) return { reply: "The AI Assistant didn't return a response." };

      const msg = choice.message;

      if (choice.finish_reason === "tool_calls" && msg.tool_calls?.length) {
        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

        for (const call of msg.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(call.function.arguments || "{}");
          } catch {
            // malformed args — pass an empty object through, tool will report what's missing
          }
          const result = await runParentAssistantTool(call.function.name, input, supabase, parent);
          messages.push({ role: "tool", tool_call_id: call.id, content: result });
        }
        continue;
      }

      return { reply: (msg.content ?? "").trim() || "I don't have a response for that." };
    }

    return { reply: "That took more steps than expected — try asking a more specific question." };
  } catch (err) {
    return {
      reply: "Something went wrong talking to the AI Assistant.",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
