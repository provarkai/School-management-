"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createLessonNote, draftLessonNoteContent } from "./actions";

export function NewLessonNoteForm({
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
  const [topic, setTopic] = useState("");
  const [lessonDate, setLessonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState("");
  const [asDraft, setAsDraft] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function draftContent() {
    setError(null);
    startDrafting(async () => {
      const result = await draftLessonNoteContent(subject, topic, classId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.text) setContent(result.text);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!classId) return setError("Choose a class.");
    if (!subject.trim()) return setError("Enter a subject.");
    if (!topic.trim()) return setError("Enter a topic.");

    const file = fileRef.current?.files?.[0];
    if (!file && !content.trim()) {
      return setError("Write the note or attach a file.");
    }

    setUploading(true);

    let filePath = "";
    let fileName = "";
    if (file) {
      const supabase = createClient();
      const path = `${schoolId}/${classId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("lesson-notes")
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
    formData.set("topic", topic.trim());
    formData.set("lesson_date", lessonDate);
    formData.set("content", content.trim());
    formData.set("file_path", filePath);
    formData.set("file_name", fileName);
    if (asDraft) formData.set("as_draft", "on");

    const result = await createLessonNote({}, formData);
    setUploading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSubject("");
    setTopic("");
    setContent("");
    setAsDraft(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <h2 className="text-sm font-semibold text-zinc-900">New lesson note</h2>
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
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          list="lesson-note-subjects"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <datalist id="lesson-note-subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Topic
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Fractions — addition and subtraction"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Lesson date
        <input
          type="date"
          value={lessonDate}
          onChange={(e) => setLessonDate(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <div className="flex items-center justify-between sm:col-span-2">
        <label htmlFor="lesson-note-content" className="text-sm font-medium text-zinc-700">
          Note content (optional if attaching a file)
        </label>
        <button
          type="button"
          onClick={draftContent}
          disabled={drafting}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {drafting ? "Drafting…" : "✨ Draft with AI"}
        </button>
      </div>
      <label className="sm:col-span-2">
        <textarea
          id="lesson-note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Objectives, method, materials, evaluation…"
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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

      <label className="flex items-center gap-2 self-end text-sm font-medium text-zinc-700">
        <input
          type="checkbox"
          checked={asDraft}
          onChange={(e) => setAsDraft(e.target.checked)}
          className="rounded border-zinc-300"
        />
        Save as draft instead of submitting for review
      </label>

      <button
        type="submit"
        disabled={uploading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {uploading ? "Saving…" : asDraft ? "Save draft" : "Submit for review"}
      </button>
    </form>
  );
}
