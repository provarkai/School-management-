"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function SchoolLogoUploader({
  schoolId,
  schoolName,
  initialUrl,
  onSave,
}: {
  schoolId: string;
  schoolName: string;
  initialUrl: string | null;
  onSave: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `school-logos/${schoolId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
    setUrl(publicUrl);
    startTransition(async () => {
      await onSave(publicUrl);
    });
  }

  return (
    <div className="flex items-center gap-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={schoolName}
          className="h-16 w-16 rounded-lg border border-zinc-200 object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
          No logo
        </div>
      )}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || pending}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : pending ? "Saving…" : "Change logo"}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
