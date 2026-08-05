"use server";

import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter, isAiConfigured, type OpenRouterMessage } from "@/lib/ai/client";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/ai/tools";
import { TERM_LABELS, type Term } from "@/lib/types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskAssistantResult {
  reply: string;
  error?: string;
}

const MAX_TOOL_ITERATIONS = 5;
// Every message is a paid OpenRouter call; this is an abuse backstop, not
// a product quota, so it's set generously.
const DAILY_MESSAGE_LIMIT = 200;
// The client sends the whole conversation back on every turn — cap it so
// one request can't be made arbitrarily expensive by a long-running chat.
const MAX_HISTORY_TURNS = 20;

export async function askAssistant(
  history: ChatTurn[],
  message: string
): Promise<AskAssistantResult> {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return {
      reply:
        "The AI Assistant needs an OPENROUTER_API_KEY configured on the server before it can answer questions. Ask whoever deployed the app to set it.",
    };
  }

  const supabase = await createClient();

  const { data: usageCount } = await supabase.rpc("increment_assistant_usage");
  if ((usageCount ?? 0) > DAILY_MESSAGE_LIMIT) {
    return {
      reply: "You've reached today's message limit for the AI Assistant. It resets at midnight.",
    };
  }

  const recentHistory = history.slice(-MAX_HISTORY_TURNS);

  const term = (user.school?.current_term ?? "1") as Term;
  const systemPrompt = `You are the AI Assistant inside a school management app, helping ${
    user.profile.role === "proprietor" ? "a school proprietor/admin" : "a teacher"
  } at ${user.school?.name ?? "their school"} (${user.school?.current_session ?? ""}, ${TERM_LABELS[term]}).

Answer questions about students, fees, attendance, and results using the provided tools — never guess or make up numbers. If a tool returns no data or an access-related empty result, say so plainly rather than inventing an answer. You can draft (but never send) fee reminder messages when asked, prioritize which owing parents to follow up with first, flag at-risk students, summarize a class's attendance/behavior/fees, narrate how a term is trending, and analyze whether past reminders are working. Keep answers short and direct; use a list only when enumerating multiple students. You cannot take actions outside these tools — you cannot record payments, mark attendance, or send messages yourself.`;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((h) => ({ role: h.role, content: h.content }) as OpenRouterMessage),
    { role: "user", content: message },
  ];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await callOpenRouter(messages, ASSISTANT_TOOLS);
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
          const result = await runAssistantTool(call.function.name, input, supabase, user);
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
