import { DeleteDocumentButton } from "./DeleteDocumentButton";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentRow {
  id: string;
  label: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
  file_path: string;
  signedUrl: string | null;
}

export function DocumentsList({
  studentId,
  documents,
  canDelete,
}: {
  studentId: string;
  documents: DocumentRow[];
  canDelete: boolean;
}) {
  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
        No documents uploaded yet.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <ul className="divide-y divide-zinc-100">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">{doc.label}</p>
              <p className="text-xs text-zinc-400">
                {doc.file_name} {formatSize(doc.size_bytes) && `· ${formatSize(doc.size_bytes)}`} ·{" "}
                {doc.created_at.slice(0, 10)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {doc.signedUrl && (
                <a
                  href={doc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  View
                </a>
              )}
              {canDelete && (
                <DeleteDocumentButton studentId={studentId} documentId={doc.id} filePath={doc.file_path} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
