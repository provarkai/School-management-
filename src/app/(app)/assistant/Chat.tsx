"use client";

import { useRef, useState, useTransition } from "react";
import { askAssistant, type ChatTurn } from "./actions";

const SUGGESTIONS = [
  "How are we doing on fees this term?",
  "Which students in JSS1 are owing?",
  "Any students with 3 or more absences recently?",
  "Draft a reminder for Chidinma Okafor",
];

export function Chat() {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;
    setError(null);
    setInput("");
    const nextHistory: ChatTurn[] = [...history, { role: "user", content: trimmed }];
    setHistory(nextHistory);

    startTransition(async () => {
      const result = await askAssistant(history, trimmed);
      setHistory((h) => [...h, { role: "assistant", content: result.reply }]);
      if (result.error) setError(result.error);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {history.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Ask about students, fees, attendance, or results. Try one of these:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                turn.role === "user"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {turn.content}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-400">Thinking…</div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">Debug: {error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-zinc-100 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
