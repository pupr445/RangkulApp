-- Migration 011 — Team Membership + Pembatasan Akses Chat per Tim
-- Jalankan di Supabase SQL Editor setelah migration 010.
--
-- Sebelumnya, "tim" (teams) di app ini murni kategori/label untuk
-- mengelompokkan tugas & channel chat — TIDAK ada konsep "siapa anggota
-- tim mana" di database sama sekali. Akibatnya semua anggota organisasi
-- bisa baca & kirim pesan di SEMUA channel Chat per Tim, bukan cuma
-- anggota tim terkait. Migration ini menambahkan tabel keanggotaan tim
-- yang sesungguhnya, lalu memakainya untuk membatasi akses channel chat.
--
-- Owner/Manager organisasi TETAP bisa akses semua channel tim (untuk
-- keperluan pengawasan/oversight) tanpa perlu didaftarkan manual sebagai
-- anggota tim tsb — lewat helper is_org_manager() yang sudah ada sejak
-- migration 006.

create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table team_members enable row level security;

-- Semua anggota organisasi boleh LIHAT daftar keanggotaan tim (supaya
-- misalnya bisa lihat "Kelas 7A beranggotakan 5 orang" di UI) — yang
-- dibatasi adalah AKSES CHAT-nya, bukan visibilitas daftar anggota tim.
create policy "team_members_select" on team_members
  for select using (is_org_member(organization_id));

-- Hanya Owner/Manager yang boleh menambah/menghapus anggota tim.
create policy "team_members_insert" on team_members
  for insert with check (is_org_manager(organization_id));
create policy "team_members_delete" on team_members
  for delete using (is_org_manager(organization_id));

-- Helper: apakah user saat ini anggota tim tsb?
create or replace function is_team_member(t_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members where team_id = t_id and user_id = auth.uid()
  );
$$;

-- Perketat akses channel Chat per Tim: pesan dengan team_id terisi
-- (recipient_id tetap NULL, karena ini bukan DM) hanya boleh dibaca/ditulis
-- oleh anggota tim tsb ATAU owner/manager organisasi. Diskusi Umum
-- (team_id NULL) dan DM (recipient_id terisi) TIDAK berubah perilakunya.
drop policy if exists "messages_select" on messages;
create policy "messages_select" on messages
  for select using (
    is_org_member(organization_id)
    and (
      -- DM: cuma pengirim & penerima
      (recipient_id is not null and (sender_id = auth.uid() or recipient_id = auth.uid()))
      -- Diskusi Umum: semua anggota organisasi
      or (recipient_id is null and team_id is null)
      -- Channel per Tim: anggota tim tsb, atau owner/manager
      or (recipient_id is null and team_id is not null and (is_team_member(team_id) or is_org_manager(organization_id)))
    )
  );

drop policy if exists "messages_insert" on messages;
create policy "messages_insert" on messages
  for insert with check (
    is_org_member(organization_id)
    and sender_id = auth.uid()
    and (team_id is null or is_team_member(team_id) or is_org_manager(organization_id))
  );
