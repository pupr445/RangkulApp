-- Migration 007 — Cegah Satu User Punya Lebih dari 1 Organisasi (sebagai Owner)
-- Jalankan di Supabase SQL Editor setelah migration 006.
--
-- PENTING: Sebelum menjalankan ini, cek dulu apakah owner_id kamu sudah
-- ada di lebih dari satu baris organizations (lihat instruksi di chat).
-- Kalau ada duplikat, hapus salah satunya dulu lewat Table Editor,
-- BARU jalankan migration ini — kalau tidak, perintah di bawah akan gagal
-- dengan pesan error "could not create unique constraint".

alter table organizations
  add constraint organizations_owner_id_unique unique (owner_id);
