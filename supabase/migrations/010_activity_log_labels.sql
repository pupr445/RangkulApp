-- Migration 010 — Activity Log: kolom label yang bisa dibaca
-- Jalankan di Supabase SQL Editor setelah migration 009.
--
-- Tabel activity_logs sudah ada sejak schema.sql awal (id, organization_id,
-- actor_id, action, target_type, target_id, created_at) tapi belum pernah
-- dipakai kode manapun. Sebelum dipakai, kita tambah 3 kolom supaya log
-- tetap terbaca meskipun task/tim/anggota yang direferensikan sudah
-- dihapus di kemudian hari — pola yang sama seperti messages.sender_name
-- (denormalisasi nama, bukan cuma FK id) yang sudah dipakai di app ini.

alter table activity_logs add column if not exists actor_name text;
alter table activity_logs add column if not exists target_label text;
alter table activity_logs add column if not exists detail text;

-- Catatan: target_id tetap uuid dan boleh NULL — dipakai untuk task/tim
-- (bisa di-link balik kalau entitasnya masih ada), tapi untuk aktivitas
-- yang objeknya bukan uuid (mis. nama file dokumen di Supabase Storage)
-- target_id dibiarkan NULL dan target_label jadi satu-satunya sumber info.
