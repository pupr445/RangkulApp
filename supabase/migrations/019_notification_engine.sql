-- Migration 019 — Notification Engine: preferences, invitation & overdue rules
-- Melengkapi Fase 5 Master Roadmap: Notification Rules, Notification Preferences.

-- Preferensi EMAIL disimpan di tabel TERSENDIRI (bukan kolom baru di
-- organization_members) dengan sengaja — supaya tidak menyentuh semantik
-- role/keanggotaan sama sekali. Alasan konkret: Owner organisasi TIDAK
-- selalu punya baris di organization_members (dia diidentifikasi lewat
-- organizations.owner_id, lihat lib/data/org.ts), jadi kalau preferensi
-- disimpan sebagai kolom di sana, Owner tidak akan pernah bisa menyimpan
-- preferensinya. Tabel terpisah ini murni "1 baris per user", berlaku
-- untuk Owner, Manager, maupun Member tanpa pengecualian.
create table if not exists notification_email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table notification_email_prefs enable row level security;

create policy "notification_email_prefs_select" on notification_email_prefs
  for select using (user_id = auth.uid());

create policy "notification_email_prefs_upsert" on notification_email_prefs
  for insert with check (user_id = auth.uid());

create policy "notification_email_prefs_update" on notification_email_prefs
  for update using (user_id = auth.uid());

-- Tandai notifikasi mana yang SUDAH dikirim lewat email digest worker,
-- supaya worker tidak mengirim ulang notifikasi yang sama berkali-kali.
-- NULL = belum pernah diproses oleh digest worker.
alter table notifications
  add column if not exists emailed_at timestamptz;

create index if not exists notifications_pending_email_idx
  on notifications (user_id, created_at)
  where emailed_at is null;

-- Tambah tipe notifikasi baru: undangan diterima, dan tugas yang sudah
-- terlambat (beda dari 'deadline' yang untuk H-1/hari-H, 'overdue' untuk
-- pengingat berulang selama tugas belum selesai & sudah lewat tenggat).
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in ('mention', 'assignment', 'dm', 'status_changed', 'deadline', 'invitation', 'overdue'));
