import Anthropic from "@anthropic-ai/sdk";

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function createAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const ASSISTANT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
