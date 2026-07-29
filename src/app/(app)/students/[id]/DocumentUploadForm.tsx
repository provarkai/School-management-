"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordStudentDocument } from "../actions";

export function DocumentUploadForm({ studentId, schoolId }: { studentId: string; schoolId: string }) {
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const file = inputRef.current?.files?.[0];
    if (!label.trim()) {
      setError("Enter a label for this document.");
      return;
    }
    if (!file) {
      setError("Choose a file.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const path = `${schoolId}/${studentId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("student-documents")
      .upload(path, file);

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const formData = new FormData();
    formData.set("label", label.trim());
    formData.set("file_path", path);
    formData.set("file_name", file.name);
    formData.set("content_type", file.type);
    formData.set("size_bytes", String(file.size));

    const result = await recordStudentDocument(studentId, {}, formData);
    setUploading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setLabel("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        {error && <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Label
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Birth certificate, medical report"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        File
        <input
          ref={inputRef}
          type="file"
          className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </label>
      <button
        type="submit"
        disabled={uploading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {uploading ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
