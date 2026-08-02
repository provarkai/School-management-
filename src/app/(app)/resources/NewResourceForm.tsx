"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createResource } from "./actions";

export function NewResourceForm({
  schoolId,
  classes,
  subjects,
  defaultClassId,
}: {
  schoolId: string;
  classes: { id: string; name: string }[];
  subjects: string[];
  defaultClassId: string;
}) {
  const [classId, setClassId] = useState(defaultClassId);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!classId) return setError("Choose a class.");
    if (!title.trim()) return setError("Enter a title.");

    const file = fileRef.current?.files?.[0];
    if (!file && !externalUrl.trim()) {
      return setError("Attach a file or paste a link.");
    }

    setUploading(true);

    let filePath = "";
    let fileName = "";
    if (file) {
      const supabase = createClient();
      const path = `${schoolId}/${classId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("learning-resources")
        .upload(path, file);

      if (uploadError) {
        setUploading(false);
        setError(uploadError.message);
        return;
      }
      filePath = path;
      fileName = file.name;
    }

    const formData = new FormData();
    formData.set("class_id", classId);
    formData.set("subject", subject.trim());
    formData.set("title", title.trim());
    formData.set("description", description.trim());
    formData.set("external_url", externalUrl.trim());
    formData.set("file_path", filePath);
    formData.set("file_name", fileName);

    const result = await createResource({}, formData);
    setUploading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setTitle("");
    setDescription("");
    setExternalUrl("");
    setSubject("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <h2 className="text-sm font-semibold text-zinc-900">Share a resource</h2>
        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>

      <label className="text-sm font-medium text-zinc-700">
        Class
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Subject (optional)
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          list="resource-subjects"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <datalist id="resource-subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chapter 3 revision notes"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Description (optional)
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Link (optional)
        <input
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Or attach a file
        <input
          ref={fileRef}
          type="file"
          className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </label>

      <button
        type="submit"
        disabled={uploading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {uploading ? "Sharing…" : "Share resource"}
      </button>
    </form>
  );
}
