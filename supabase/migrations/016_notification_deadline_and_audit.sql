-- Migration 016 — Notification enrichment
-- Menambahkan tipe deadline dan metadata yang membuat notifikasi lebih mudah
-- difilter/ditelusuri tanpa mengganggu notifikasi lama.

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in ('mention', 'assignment', 'dm', 'status_changed', 'deadline'));

create index if not exists notifications_org_created_idx
  on notifications (organization_id, created_at desc);

create index if not exists notifications_user_type_idx
  on notifications (user_id, type, created_at desc);
