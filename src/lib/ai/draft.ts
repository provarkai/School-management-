import { callOpenRouter, contentText, isAiConfigured } from "@/lib/ai/client";

export interface DraftResult {
  text?: string;
  error?: string;
}

/**
 * One-shot text generation — no tool-calling loop, no chat history. Used by
 * every "Draft with AI" button (report card remarks, lesson notes,
 * broadcasts, notices, admissions messages) so each of those call sites
 * doesn't reimplement the same isAiConfigured()/error-handling shape the
 * chat assistant already has in src/app/(app)/assistant/actions.ts.
 */
export async function draftText(systemPrompt: string, userPrompt: string): Promise<DraftResult> {
  if (!isAiConfigured()) {
    return { error: "The AI Assistant isn't configured on this server yet — ask whoever deployed the app to set OPENROUTER_API_KEY." };
  }

  try {
    const response = await callOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      []
    );
    const text = contentText(response.choices[0]?.message.content).trim();
    if (!text) return { error: "The AI Assistant didn't return a draft — try again." };
    return { text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong talking to the AI Assistant." };
  }
}
