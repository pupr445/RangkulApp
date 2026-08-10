"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/lib/labels/LabelProvider";

interface FileRow {
  name: string;
  sizeLabel: string;
  updatedAt: string;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocsManager({ organizationId }: { organizationId: string }) {
  const labels = useLabels();
  const supabase = createClient();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const { data, error: listError } = await supabase.storage
      .from("documents")
      .list(organizationId, { sortBy: { column: "updated_at", order: "desc" } });

    if (listError) {
      // Bucket kemungkinan belum dibuat — lihat supabase/migrations/002_chat_and_docs.sql
      setError(
        "Bucket 'documents' belum tersedia. Jalankan supabase/migrations/002_chat_and_docs.sql terlebih dahulu."
      );
      setFiles([]);
    } else {
      setError(null);
      setFiles(
        (data ?? [])
          .filter((f) => f.name !== ".emptyFolderPlaceholder")
          .map((f) => ({
            name: f.name,
            sizeLabel: formatBytes(f.metadata?.size as number | undefined),
            updatedAt: f.updated_at ? new Date(f.updated_at).toLocaleDateString("id-ID") : "-",
          }))
      );
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const path = `${organizationId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);

    setUploading(false);
    if (uploadError) {
      setError(uploadError.message);
    } else {
      await loadFiles();
    }
    e.target.value = "";
  }

  async function handleDownload(name: string) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(`${organizationId}/${name}`, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{labels.navDocs}</h1>
          <p className="text-sm text-inkMuted">File & dokumen bersama untuk seluruh organisasi.</p>
        </div>
        <label
          className="text-white rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer transition"
          style={{ backgroundColor: labels.accent, opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? "Mengunggah…" : "+ Unggah File"}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {error && (
        <div className="bg-[#FBEAE5] border border-[#E3B8A9] text-[#8A3E24] text-sm rounded-lg px-4 py-3 mb-5">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {loading && <p className="text-sm text-inkMuted p-6 text-center">Memuat…</p>}
        {!loading && files.length === 0 && !error && (
          <p className="text-sm text-inkMuted p-6 text-center">Belum ada file yang diunggah.</p>
        )}
        {!loading &&
          files.map((f, idx) => (
            <div
              key={f.name}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 flex-wrap ${
                idx !== files.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg shrink-0">📄</span>
                <span className="text-sm font-medium truncate">{f.name.replace(/^\d+_/, "")}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-inkMuted shrink-0">
                <span>{f.sizeLabel}</span>
                <span>{f.updatedAt}</span>
                <button
                  onClick={() => handleDownload(f.name)}
                  className="font-semibold underline"
                  style={{ color: labels.accent }}
                >
                  Unduh
                </button>
              </div>
            </div>
          ))}
      </div>
    </main>
  );
}
