"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { logActivity } from "@/lib/data/activity-log";
import {
  DocumentFolder,
  DocumentRow,
  createFolder,
  deleteDocument,
  deleteFolder,
  fetchDocuments,
  fetchFolderPath,
  fetchFolders,
  fetchVersionHistory,
  searchDocuments,
} from "@/lib/data/documents";

function formatBytes(bytes?: number | null) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocsManager({ organizationId }: { organizationId: string }) {
  const labels = useLabels();
  const currentUserId = useCurrentUserId();
  const supabase = createClient();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DocumentFolder[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [files, setFiles] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DocumentRow[] | null>(null);
  const [historyFor, setHistoryFor] = useState<DocumentRow | null>(null);
  const [history, setHistory] = useState<DocumentRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [foldersData, filesData, path] = await Promise.all([
      fetchFolders(supabase, organizationId, currentFolderId),
      fetchDocuments(supabase, organizationId, currentFolderId),
      currentFolderId ? fetchFolderPath(supabase, currentFolderId) : Promise.resolve([]),
    ]);
    setFolders(foldersData);
    setFiles(filesData);
    setBreadcrumb(path);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, currentFolderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Pencarian lintas folder — debounce ringan supaya tidak query di setiap ketikan.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchResults(await searchDocuments(supabase, organizationId, q));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, organizationId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, replacingDoc?: DocumentRow) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const path = `${organizationId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      e.target.value = "";
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    const actorName = (u?.user_metadata?.full_name as string | undefined) ?? u?.email?.split("@")[0] ?? "Seseorang";

    const isNewVersion = Boolean(replacingDoc);
    const rootId = replacingDoc?.root_document_id ?? replacingDoc?.id ?? null;
    const nextVersion = replacingDoc ? replacingDoc.version + 1 : 1;

    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert([
        {
          organization_id: organizationId,
          folder_id: currentFolderId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: currentUserId,
          root_document_id: rootId,
          version: nextVersion,
        },
      ])
      .select("id")
      .single();

    setUploading(false);
    e.target.value = "";

    if (insertError) {
      setError(insertError.message);
      return;
    }

    // Kalau ini VERSI PERTAMA (belum punya root_document_id), jadikan
    // dirinya sendiri sebagai root — supaya versi berikutnya bisa
    // menunjuk ke keluarga yang benar.
    if (!isNewVersion && inserted) {
      await supabase.from("documents").update({ root_document_id: (inserted as { id: string }).id }).eq("id", (inserted as { id: string }).id);
    }

    logActivity(supabase, {
      organizationId,
      actorId: currentUserId,
      actorName,
      action: isNewVersion ? "document.new_version" : "document.uploaded",
      targetType: "document",
      targetId: null,
      targetLabel: isNewVersion ? `${file.name} (v${nextVersion})` : file.name,
    });
    await load();
  }

  async function handleDownload(doc: DocumentRow) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDeleteFile(doc: DocumentRow) {
    if (!confirm(`Hapus "${doc.file_name}"? Semua versi lamanya juga ikut terhapus.`)) return;
    // Hapus seluruh keluarga versi, bukan cuma versi aktif — supaya tidak
    // ada storage object "yatim" yang tidak bisa diakses lagi dari UI.
    const rootId = doc.root_document_id ?? doc.id;
    const allVersions = await fetchVersionHistory(supabase, rootId);
    for (const v of allVersions.length ? allVersions : [doc]) {
      await deleteDocument(supabase, v);
    }
    await load();
  }

  async function handleShowHistory(doc: DocumentRow) {
    const rootId = doc.root_document_id ?? doc.id;
    setHistory(await fetchVersionHistory(supabase, rootId));
    setHistoryFor(doc);
  }

  async function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setCreatingFolder(true);
    const { error: e } = await createFolder(supabase, { organizationId, name: trimmed, parentId: currentFolderId, userId: currentUserId });
    setCreatingFolder(false);
    if (e) { setError(e.message); return; }
    setNewFolderName("");
    await load();
  }

  async function handleDeleteFolder(folder: DocumentFolder) {
    if (!confirm(`Hapus folder "${folder.name}"? Isi di dalamnya (subfolder & file) juga ikut terhapus.`)) return;
    await deleteFolder(supabase, folder.id);
    await load();
  }

  const displayedFiles = searchResults ?? files;

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">{labels.navDocs}</h1>
          <p className="text-sm text-inkMuted">File & dokumen bersama untuk seluruh organisasi.</p>
        </div>
        <label
          className="text-white rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer transition"
          style={{ backgroundColor: labels.accent, opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? "Mengunggah…" : "+ Unggah File"}
          <input type="file" className="hidden" onChange={(e) => handleUpload(e)} disabled={uploading} />
        </label>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama file di seluruh folder…"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink mb-4"
      />

      {!search.trim() && (
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-1.5 text-sm flex-wrap">
            <button onClick={() => setCurrentFolderId(null)} className="font-medium hover:underline" style={{ color: currentFolderId ? labels.accent : undefined }}>
              📁 Semua File
            </button>
            {breadcrumb.map((b) => (
              <span key={b.id} className="flex items-center gap-1.5">
                <span className="text-inkMuted">/</span>
                <button onClick={() => setCurrentFolderId(b.id)} className="font-medium hover:underline" style={{ color: labels.accent }}>
                  {b.name}
                </button>
              </span>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex gap-2">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              placeholder="Nama folder baru"
              className="border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-ink"
            />
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-surfaceAlt shrink-0"
            >
              + Folder
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#FBEAE5] border border-[#E3B8A9] text-[#8A3E24] text-sm rounded-lg px-4 py-3 mb-5">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {loading && <p className="text-sm text-inkMuted p-6 text-center">Memuat…</p>}

        {!loading && !search.trim() &&
          folders.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border hover:bg-surfaceAlt/60 transition">
              <button onClick={() => setCurrentFolderId(f.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <span className="text-lg shrink-0">📁</span>
                <span className="text-sm font-medium truncate">{f.name}</span>
              </button>
              <button onClick={() => handleDeleteFolder(f)} className="text-xs font-semibold text-[#8A3E24] shrink-0">
                Hapus
              </button>
            </div>
          ))}

        {!loading && displayedFiles.length === 0 && folders.length === 0 && (
          <p className="text-sm text-inkMuted p-6 text-center">
            {search.trim() ? "Tidak ada file yang cocok." : "Folder ini masih kosong."}
          </p>
        )}

        {!loading &&
          displayedFiles.map((f, idx) => (
            <div
              key={f.id}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 flex-wrap ${
                idx !== displayedFiles.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg shrink-0">📄</span>
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{f.file_name}</span>
                  {f.version > 1 && <span className="text-[10px] text-inkMuted">Versi {f.version}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-inkMuted shrink-0 flex-wrap">
                <span>{formatBytes(f.size_bytes)}</span>
                <span>{new Date(f.created_at).toLocaleDateString("id-ID")}</span>
                <button onClick={() => handleShowHistory(f)} className="font-semibold underline text-inkMuted">
                  Riwayat
                </button>
                <label className="font-semibold underline cursor-pointer" style={{ color: labels.accent }}>
                  Versi baru
                  <input type="file" className="hidden" onChange={(e) => handleUpload(e, f)} disabled={uploading} />
                </label>
                <button onClick={() => handleDownload(f)} className="font-semibold underline" style={{ color: labels.accent }}>
                  Unduh
                </button>
                <button onClick={() => handleDeleteFile(f)} className="font-semibold text-[#8A3E24]">
                  Hapus
                </button>
              </div>
            </div>
          ))}
      </div>

      {historyFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setHistoryFor(null)}>
          <div className="bg-surface rounded-card p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Riwayat versi — {historyFor.file_name}</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {history.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2">
                  <span>
                    v{v.version} — {new Date(v.created_at).toLocaleDateString("id-ID")} · {formatBytes(v.size_bytes)}
                  </span>
                  <button onClick={() => handleDownload(v)} className="font-semibold underline" style={{ color: labels.accent }}>
                    Unduh
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setHistoryFor(null)} className="text-xs font-semibold mt-4 px-3 py-1.5 rounded-lg border border-border">
              Tutup
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
