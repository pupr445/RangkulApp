-- Migration 004 — Nilai Custom Field pada Tugas
-- Jalankan di Supabase SQL Editor setelah migration 003.
--
-- Tabel `custom_fields` (definisi field) sudah ada sejak schema.sql awal.
-- Migration ini menambahkan TEMPAT PENYIMPANAN nilainya di tiap tugas:
-- satu kolom JSONB fleksibel, alih-alih menambah kolom baru tiap kali ada
-- field custom baru (yang akan butuh migration berulang-ulang).
--
-- Bentuk data: { "field_key_1": "nilai isian", "field_key_2": "90" }

alter table tasks add column if not exists custom_data jsonb not null default '{}'::jsonb;
