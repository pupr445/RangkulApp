-- Migration 012 — Notification System
-- Jalankan di Supabase SQL Editor setelah migration 011.
--
-- Tabel baru untuk notifikasi in-app: @mention di chat, tugas yang
-- di-assign ke kamu, DM baru, dan perubahan status pada tugas yang kamu
-- pegang. CATATAN JUJUR: pengingat deadline otomatis (H-1/hari-H) SENGAJA
-- tidak dibuat di migration ini — itu butuh scheduled job (mis. Cloudflare
-- Cron Triggers) yang berjalan tanpa ada user yang sedang membuka app,
-- beda kelas pekerjaan dari notifikasi berbasis aksi user seperti di sini.

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- penerima notifikasi
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  type text not null check (type in ('mention', 'assignment', 'dm', 'status_changed')),
  content text not null,
  link text, -- path relatif untuk diarahkan saat notifikasi diklik
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

-- Penerima cuma bisa lihat & tandai-dibaca notifikasi miliknya sendiri.
create policy "notifications_select" on notifications
  for select using (user_id = auth.uid());

create policy "notifications_update" on notifications
  for update using (user_id = auth.uid());

-- Insert dilakukan oleh AKTORnya (bukan penerima) saat mereka melakukan
-- aksi seperti assign tugas atau mention di chat — jadi syaratnya cukup
-- "anggota organisasi yang sama", bukan user_id = auth.uid().
create policy "notifications_insert" on notifications
  for insert with check (is_org_member(organization_id));

alter publication supabase_realtime add table notifications;

create index if not exists notifications_user_unread_idx
  on notifications (user_id, is_read, created_at desc);
