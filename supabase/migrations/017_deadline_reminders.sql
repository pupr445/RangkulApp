-- Migration 017 — Deadline reminder deduplication metadata
-- Menambahkan metadata untuk reminder deadline yang dijalankan oleh scheduler.
-- Tidak mengubah notification lama; kolom baru bersifat nullable.

alter table notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_uidx
  on notifications (dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_entity_idx
  on notifications (entity_type, entity_id, created_at desc)
  where entity_id is not null;
