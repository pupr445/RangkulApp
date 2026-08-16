-- Migration 025 — Pisahkan System Role, Sector Position, dan Sector Entity
-- (lihat Temuan_QA_Role_Sector_Position_RANGKUL_Lengkap.docx)
--
-- MASALAH: label ownerRole/managerRole/memberRole di lib/labels/sectors.ts
-- (mis. Klinik: "Dokter Kepala" / "Dokter" / "Pasien") sebelumnya dipakai
-- LANGSUNG sebagai (a) identitas yang ditampilkan di header, dan (b)
-- pilihan dropdown saat mengundang anggota baru. Akibatnya "Pasien" —
-- yang seharusnya data/entitas klinik, BUKAN anggota internal — muncul
-- sebagai pilihan role saat mengundang orang ke organisasi.
--
-- PERBAIKAN: tambah kolom "sector_position" terpisah dari "role" (system
-- role: owner/manager/member tetap seperti semula, tidak diubah). Posisi
-- sektoral kini murni informasi jabatan/fungsi (mis. "Dokter", "Perawat",
-- "Guru", "Sales") yang berjalan BERSAMA system role, bukan menggantikan.

-- Owner tidak selalu punya baris di organization_members (lihat catatan
-- di schema.sql & lib/data/members.ts) — sengaja TIDAK diubah di sini
-- untuk menghindari risiko duplikasi pada banyak tempat yang sudah
-- terbiasa dengan pola ini. Posisi sektoral Owner disimpan di kolom
-- terpisah pada tabel organizations.
alter table organizations
  add column if not exists owner_sector_position text;

alter table organization_members
  add column if not exists sector_position text;

-- Undangan yang masih pending juga perlu membawa posisi sektoral yang
-- dipilih saat mengundang, supaya begitu diterima, posisinya ikut
-- tersimpan ke organization_members (bukan cuma role).
alter table invitations
  add column if not exists sector_position text;
