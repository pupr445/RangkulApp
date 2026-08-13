-- Migration 009 — Custom Field Builder
-- Jalankan di Supabase SQL Editor setelah migration 008.
--
-- Menambahkan dukungan tipe field "select" (dropdown pilihan) dan flag
-- "wajib diisi" ke custom_fields, sehingga admin bisa membangun field
-- yang lebih kaya (bukan cuma teks/angka/tanggal bebas).

-- field_options: daftar pilihan untuk tipe "select", disimpan sebagai
-- array JSON teks, mis. ["Ringan", "Sedang", "Berat"]. NULL/kosong untuk
-- tipe field lain (text/number/date).
alter table custom_fields
  add column if not exists field_options jsonb;

-- is_required: kalau true, field wajib diisi sebelum tugas bisa disimpan
-- (divalidasi di sisi aplikasi/frontend).
alter table custom_fields
  add column if not exists is_required boolean not null default false;

-- Catatan: kolom field_type sudah punya check constraint yang mengizinkan
-- 'select' sejak schema.sql awal (lihat baris `field_type in
-- ('text','number','date','select')`), jadi tidak perlu diubah lagi di sini.
