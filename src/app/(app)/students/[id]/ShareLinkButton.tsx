"use client";

import { useState } from "react";

export function ShareLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — fall back to selecting the visible link text
    }
  }

  return (
    <div className="rounded-md border border-zinc-300 bg-white shadow-sm">
      <button
        type="button"
        onClick={copy}
        className="w-full truncate px-4 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        title={url}
      >
        {copied ? "Copied!" : "Copy parent share link"}
      </button>
    </div>
  );
}
