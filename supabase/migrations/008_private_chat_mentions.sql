-- Migration 008 — Chat Privat + Read-by
-- Jalankan di Supabase SQL Editor setelah migration 007.

-- Kolom baru: kalau diisi, pesan ini adalah DM (chat privat) antara
-- sender_id dan recipient_id. Kalau NULL, pesan ini masuk "Diskusi Tim"
-- (chat umum se-organisasi, seperti sebelumnya).
alter table messages add column if not exists recipient_id uuid references auth.users(id) on delete set null;

-- Menyimpan kapan terakhir seorang user "membaca" sebuah percakapan.
-- conversation_key: 'team' untuk Diskusi Tim, atau "dm:<id-kecil>:<id-besar>"
-- (dua id user diurutkan supaya konsisten) untuk chat privat.
create table if not exists message_reads (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null,
  last_read_at timestamptz not null default now(),
  unique (user_id, conversation_key)
);

alter table message_reads enable row level security;

create policy "message_reads_own_select" on message_reads
  for select using (is_org_member(organization_id) and user_id = auth.uid());
create policy "message_reads_own_upsert" on message_reads
  for insert with check (is_org_member(organization_id) and user_id = auth.uid());
create policy "message_reads_own_update" on message_reads
  for update using (user_id = auth.uid());

-- Ganti kebijakan `messages_all` (dari schema.sql) menjadi lebih ketat:
-- pesan DM cuma boleh dilihat oleh pengirim & penerimanya, bukan seluruh
-- anggota organisasi seperti pesan Diskusi Tim.
drop policy if exists "messages_all" on messages;

create policy "messages_select" on messages
  for select using (
    is_org_member(organization_id)
    and (recipient_id is null or sender_id = auth.uid() or recipient_id = auth.uid())
  );

create policy "messages_insert" on messages
  for insert with check (
    is_org_member(organization_id) and sender_id = auth.uid()
  );

-- Aktifkan Realtime untuk message_reads (dipakai indikator "sudah dibaca").
alter publication supabase_realtime add table message_reads;
