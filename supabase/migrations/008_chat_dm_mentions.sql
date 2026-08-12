-- Migration 008 — Chat Privat, Read-by, dan Mention
-- Jalankan di Supabase SQL Editor setelah migration 007.

-- Kolom baru: kalau diisi, pesan ini adalah pesan PRIVAT ke user tsb.
-- Kalau NULL, pesan ini pesan grup/umum (perilaku lama, tetap berjalan).
alter table messages add column if not exists dm_with uuid references auth.users(id) on delete cascade;

-- Pelacakan "sudah dibaca sampai mana" per percakapan per user. Dipakai
-- untuk menampilkan status "Dibaca" pada pesan privat (seperti centang
-- biru). conversation_key: 'org' untuk chat grup umum, atau
-- "<id_kecil>:<id_besar>" (dua UUID diurutkan) untuk percakapan privat.
create table if not exists message_reads (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null,
  last_read_at timestamptz not null default now(),
  unique (user_id, conversation_key, organization_id)
);

alter table message_reads enable row level security;

-- Anggota organisasi boleh lihat status baca siapa saja di organisasinya
-- (perlu ini supaya bisa tahu "apakah lawan bicara sudah baca pesan saya"),
-- tapi HANYA boleh menulis/mengubah status baca miliknya sendiri.
create policy "message_reads_select" on message_reads
  for select using (is_org_member(organization_id));
create policy "message_reads_upsert" on message_reads
  for insert with check (user_id = auth.uid() and is_org_member(organization_id));
create policy "message_reads_update" on message_reads
  for update using (user_id = auth.uid());

-- PENTING: kebijakan lama `messages_all` (dari schema.sql) mengizinkan
-- SEMUA anggota organisasi melihat SEMUA pesan — termasuk yang seharusnya
-- privat. Ganti dengan kebijakan yang membedakan pesan grup vs privat:
-- pesan grup (dm_with IS NULL) tetap terlihat semua anggota, pesan privat
-- HANYA terlihat oleh pengirim dan penerimanya.
drop policy if exists "messages_all" on messages;

create policy "messages_select" on messages
  for select using (
    is_org_member(organization_id)
    and (dm_with is null or sender_id = auth.uid() or dm_with = auth.uid())
  );

create policy "messages_insert" on messages
  for insert with check (
    is_org_member(organization_id) and sender_id = auth.uid()
  );

-- Aktifkan Realtime untuk message_reads (dipakai indikator "Dibaca" live).
alter publication supabase_realtime add table message_reads;
