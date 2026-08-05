"use client";

import { useRef, useState, useTransition } from "react";
import { fileToResizedDataUrl } from "@/lib/imageCapture";

/**
 * Two entry points into the same flow: "Take photo" opens the device camera
 * directly via the `capture` attribute (no getUserMedia/live preview — the
 * app never gets a raw camera stream, just the finished photo, which is why
 * this isn't gated by the Permissions-Policy camera=() header in
 * next.config.ts), "Upload photo" opens the normal file picker for a desktop
 * user or an existing gallery shot. Both hand the resized photo to the same
 * onScan callback — the caller owns what happens with the extracted data.
 */
export function PhotoScanButton({
  label = "Scan from photo",
  onScan,
  disabled,
}: {
  label?: string;
  onScan: (imageDataUrl: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [resizing, setResizing] = useState(false);
  const [pending, startTransition] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File, input: HTMLInputElement) {
    setResizing(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setResizing(false);
      startTransition(async () => {
        await onScan(dataUrl);
      });
    } catch {
      setResizing(false);
    } finally {
      // Allow re-selecting the same file (e.g. retrying after a bad shot).
      input.value = "";
    }
  }

  const working = resizing || pending;

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], e.target)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], e.target)}
      />
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        disabled={disabled || working}
        className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
      >
        {working ? "Reading photo…" : `📷 ${label}`}
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || working}
        className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
      >
        Upload photo
      </button>
    </div>
  );
}
