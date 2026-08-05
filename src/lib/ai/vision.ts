import { callOpenRouter, isAiConfigured, type OpenRouterMessage } from "@/lib/ai/client";

export interface ExtractResult<T> {
  data?: T;
  error?: string;
}

/**
 * One-shot vision call: hand the model a photo plus a system prompt
 * describing the exact JSON shape to hand back. Used by the "scan a paper
 * sheet" buttons (attendance registers, mark sheets) — the model's job here
 * is purely OCR-and-structure. Matching whatever names/columns it returns
 * back to real roster rows, and validating every value, is always done by
 * the caller — nothing from this function is ever written to the database
 * on its own.
 */
export async function extractJsonFromImage<T>(
  systemPrompt: string,
  imageDataUrl: string
): Promise<ExtractResult<T>> {
  if (!isAiConfigured()) {
    return { error: "Photo scanning needs an OPENROUTER_API_KEY configured on the server." };
  }
  if (!imageDataUrl.startsWith("data:image/")) {
    return { error: "That doesn't look like a photo — try again." };
  }

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: imageDataUrl } },
        {
          type: "text",
          text: "Read the photo and return ONLY the JSON described above — no prose, no markdown code fences.",
        },
      ],
    },
  ];

  try {
    const response = await callOpenRouter(messages, []);
    const content = response.choices[0]?.message.content;
    const raw = typeof content === "string" ? content.trim() : "";
    if (!raw) return { error: "The AI didn't return anything for that photo." };

    // Models sometimes wrap JSON in a code fence despite being told not to.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as T;
    return { data: parsed };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Couldn't read that photo: ${err.message}`
          : "Couldn't read that photo.",
    };
  }
}
