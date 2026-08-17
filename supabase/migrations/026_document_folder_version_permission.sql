-- Migration 026 — File & Document Maturity (Fase 13 Master Roadmap)
-- Folder, Versioning, Permission. Search dikerjakan di level aplikasi
-- (filter nama file) — cukup untuk skala dokumen organisasi, tidak
-- perlu infrastruktur full-text search terpisah.
--
-- CATATAN PENTING: sebelumnya file HANYA disimpan di Supabase Storage
-- tanpa tabel metadata sama sekali (lihat migration 002) — daftar file
-- didapat langsung dari storage.list(). Migrasi ini menambahkan lapisan
-- metadata di atas Storage yang SUDAH ADA (bukan mengganti storage-nya),
-- supaya folder/versi/izin bisa diatur di level database dengan RLS.

-- ---------------------------------------------------------
-- FOLDER
-- ---------------------------------------------------------
create table if not exists document_folders (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  parent_id uuid references document_folders(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists document_folders_parent_idx on document_folders (organization_id, parent_id);

alter table document_folders enable row level security;

create policy "document_folders_select" on document_folders
  for select using (is_org_member(organization_id));

create policy "document_folders_insert" on document_folders
  for insert with check (is_org_member(organization_id));

-- Hapus folder: pembuatnya sendiri, atau Owner/Manager (konsisten
-- dengan pola moderasi yang sudah dipakai di Chat & Template).
create policy "document_folders_delete" on document_folders
  for delete using (created_by = auth.uid() or is_org_manager(organization_id));

-- ---------------------------------------------------------
-- DOCUMENT (metadata di atas Supabase Storage yang sudah ada)
-- ---------------------------------------------------------
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  folder_id uuid references document_folders(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  -- Versioning: root_document_id menunjuk ke versi PERTAMA dalam satu
  -- "keluarga" file (self-reference kalau dia sendiri versi pertama).
  -- Dokumen dengan version TERTINGGI per root_document_id = versi aktif.
  root_document_id uuid,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

alter table documents
  add constraint documents_root_document_id_fkey
  foreign key (root_document_id) references documents(id) on delete cascade;

create index if not exists documents_folder_idx on documents (organization_id, folder_id, created_at desc);
create index if not exists documents_root_idx on documents (root_document_id, version desc);
create index if not exists documents_search_idx on documents (organization_id, file_name);

alter table documents enable row level security;

create policy "documents_select" on documents
  for select using (is_org_member(organization_id));

create policy "documents_insert" on documents
  for insert with check (is_org_member(organization_id));

-- Hapus/ganti versi dokumen: pengunggah aslinya sendiri, atau
-- Owner/Manager untuk moderasi — TIDAK semua anggota organisasi
-- (perbaikan dari model lama yang cuma cek is_org_member untuk delete
-- storage.objects, lihat migration 002).
create policy "documents_delete" on documents
  for delete using (uploaded_by = auth.uid() or is_org_manager(organization_id));

-- ---------------------------------------------------------
-- PERMISSION Storage: perketat delete storage.objects supaya sejalan
-- dengan policy documents_delete di atas (bukan cuma is_org_member).
-- Perlu join balik ke tabel documents untuk tahu siapa pengunggahnya.
-- ---------------------------------------------------------
drop policy if exists "documents_delete" on storage.objects;

create policy "documents_delete" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
    and (
      is_org_manager((storage.foldername(name))[1]::uuid)
      or exists (
        select 1 from documents d
        where d.storage_path = storage.objects.name and d.uploaded_by = auth.uid()
      )
    )
  );
