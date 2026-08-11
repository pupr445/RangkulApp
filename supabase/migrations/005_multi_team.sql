-- Migration 005 — Struktur Tim Majemuk
-- Jalankan di Supabase SQL Editor setelah migration 004.
--
-- Tabel `teams` sudah ada sejak schema.sql awal, tapi belum ada kolom
-- langsung di `tasks` untuk mengaitkan satu tugas ke satu tim/kelas
-- tertentu. Migration ini menambahkannya, supaya organisasi bisa punya
-- banyak tim (mis. "Kelas 7A", "Kelas 9A", "Poli Umum", "Poli Gigi")
-- dan tugas bisa difilter per tim.

alter table tasks add column if not exists team_id uuid references teams(id) on delete set null;
