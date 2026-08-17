// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export interface DocumentFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface DocumentRow {
  id: string;
  folder_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  root_document_id: string | null;
  version: number;
  created_at: string;
}

/** Kelompokkan berdasarkan "keluarga" versi (root_document_id), sisakan cuma versi TERTINGGI per keluarga — itulah dokumen yang aktif ditampilkan. */
function latestVersionsOnly(rows: DocumentRow[]): DocumentRow[] {
  const byRoot = new Map<string, DocumentRow>();
  for (const row of rows) {
    const rootId = row.root_document_id ?? row.id;
    const existing = byRoot.get(rootId);
    if (!existing || row.version > existing.version) byRoot.set(rootId, row);
  }
  return Array.from(byRoot.values());
}

export async function fetchFolders(supabase: SupabaseAny, organizationId: string, parentId: string | null): Promise<DocumentFolder[]> {
  let query = supabase.from("document_folders").select("id, name, parent_id").eq("organization_id", organizationId);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data, error } = await query.order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as DocumentFolder[];
}

export async function fetchFolderPath(supabase: SupabaseAny, folderId: string): Promise<DocumentFolder[]> {
  const path: DocumentFolder[] = [];
  let currentId: string | null = folderId;
  // Folder biasanya cuma bersarang beberapa level — batas 20 supaya tidak infinite loop kalau data korup.
  for (let i = 0; i < 20 && currentId; i++) {
    const result = await supabase.from("document_folders").select("id, name, parent_id").eq("id", currentId).maybeSingle();
    const row = result.data as DocumentFolder | null;
    if (!row) break;
    path.unshift(row);
    currentId = row.parent_id;
  }
  return path;
}

export async function fetchDocuments(supabase: SupabaseAny, organizationId: string, folderId: string | null): Promise<DocumentRow[]> {
  let query = supabase
    .from("documents")
    .select("id, folder_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, root_document_id, version, created_at")
    .eq("organization_id", organizationId);
  query = folderId ? query.eq("folder_id", folderId) : query.is("folder_id", null);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return [];
  return latestVersionsOnly((data ?? []) as DocumentRow[]);
}

/** Cari dokumen berdasarkan nama file, LINTAS SEMUA FOLDER dalam organisasi. */
export async function searchDocuments(supabase: SupabaseAny, organizationId: string, query: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, folder_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, root_document_id, version, created_at")
    .eq("organization_id", organizationId)
    .ilike("file_name", `%${query}%`)
    .order("created_at", { ascending: false });
  if (error) return [];
  return latestVersionsOnly((data ?? []) as DocumentRow[]);
}

export async function fetchVersionHistory(supabase: SupabaseAny, rootDocumentId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, folder_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, root_document_id, version, created_at")
    .or(`id.eq.${rootDocumentId},root_document_id.eq.${rootDocumentId}`)
    .order("version", { ascending: false });
  if (error) return [];
  return (data ?? []) as DocumentRow[];
}

export async function createFolder(supabase: SupabaseAny, params: { organizationId: string; name: string; parentId: string | null; userId: string }) {
  return supabase.from("document_folders").insert([
    { organization_id: params.organizationId, name: params.name, parent_id: params.parentId, created_by: params.userId },
  ]);
}

export async function deleteFolder(supabase: SupabaseAny, id: string) {
  return supabase.from("document_folders").delete().eq("id", id);
}

export async function deleteDocument(supabase: SupabaseAny, doc: DocumentRow) {
  await supabase.storage.from("documents").remove([doc.storage_path]);
  return supabase.from("documents").delete().eq("id", doc.id);
}
