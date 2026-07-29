"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, isAiConfigured, ASSISTANT_MODEL } from "@/lib/ai/client";
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

export async function askAssistant(
  history: ChatTurn[],
  message: string
): Promise<AskAssistantResult> {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return {
      reply:
        "The AI Assistant needs an ANTHROPIC_API_KEY configured on the server before it can answer questions. Ask whoever deployed the app to set it.",
    };
  }

  const supabase = await createClient();
  const client = createAnthropicClient();

  const term = (user.school?.current_term ?? "1") as Term;
  const systemPrompt = `You are the AI Assistant inside a school management app, helping ${
    user.profile.role === "proprietor" ? "a school proprietor/admin" : "a teacher"
  } at ${user.school?.name ?? "their school"} (${user.school?.current_session ?? ""}, ${TERM_LABELS[term]}).

Answer questions about students, fees, attendance, and results using the provided tools — never guess or make up numbers. If a tool returns no data or an access-related empty result, say so plainly rather than inventing an answer. You can draft (but never send) fee reminder messages when asked. Keep answers short and direct; use a list only when enumerating multiple students. You cannot take actions outside these tools — you cannot record payments, mark attendance, or send messages yourself.`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        tools: ASSISTANT_TOOLS,
        output_config: { effort: "low" },
        messages,
      });

      if (response.stop_reason === "refusal") {
        return { reply: "I can't help with that request." };
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await runAssistantTool(
              block.name,
              block.input as Record<string, unknown>,
              supabase,
              user
            );
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      return { reply: text || "I don't have a response for that." };
    }

    return { reply: "That took more steps than expected — try asking a more specific question." };
  } catch (err) {
    return {
      reply: "Something went wrong talking to the AI Assistant.",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
