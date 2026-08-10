-- Migration 002 — kolom tambahan untuk fitur Diskusi (chat) & Dokumen
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql (kamu
-- sudah menjalankan schema.sql sebelumnya, jadi ini migration terpisah
-- alih-alih mengubah schema.sql yang sudah diterapkan).

-- Simpan nama pengirim langsung di tabel messages supaya UI chat tidak
-- perlu join ke skema auth.users (yang tidak bisa diakses langsung dari
-- client-side RLS policy dengan mudah).
alter table messages add column if not exists sender_name text;

-- Bucket Storage privat untuk fitur Dokumen. File disimpan dengan path
-- "{organization_id}/{nama_file}" sehingga bisa diisolasi per organisasi.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- RLS untuk storage.objects: hanya anggota organisasi terkait yang boleh
-- membaca/menulis file pada folder organisasinya sendiri. Folder pertama
-- pada path (storage.foldername(name))[1] harus berupa organization_id
-- tempat user tsb menjadi anggota (memakai fungsi is_org_member yang
-- sudah didefinisikan di schema.sql).
create policy "documents_select" on storage.objects
  for select using (
    bucket_id = 'documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "documents_insert" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "documents_delete" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

-- Aktifkan Realtime untuk tabel messages (dipakai fitur chat live).
-- Jika perintah ini gagal dengan pesan "already a member", abaikan saja
-- — artinya Realtime sudah aktif untuk tabel ini.
alter publication supabase_realtime add table messages;
