-- Migration 022 — tambah tipe notifikasi 'summary' untuk Daily/Weekly Automation Summary.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in ('mention', 'assignment', 'dm', 'status_changed', 'deadline', 'invitation', 'overdue', 'summary'));
