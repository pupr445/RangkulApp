-- Contoh data awal untuk sector_templates.
-- Jalankan setelah schema.sql DAN migration 009_custom_field_builder.sql.
-- Ini opsional — starter tetap berjalan tanpa seed ini karena label default
-- sudah ada di lib/labels/sectors.ts. Tabel ini membuat onboarding organisasi
-- baru otomatis mendapat struktur kerja awal yang lebih kaya: bukan cuma
-- nama tim, tapi juga field data yang relevan untuk sektor tsb (lihat
-- app/api/create-organization/route.ts).
--
-- CATATAN UPGRADE (Agustus 2026):
-- 1. Sekarang mencakup SEMUA 6 sektor (sebelumnya cuma sekolah/klinik/bisnis
--    yang punya template — masjid/komunitas/lainnya tidak dapat tim otomatis
--    sama sekali saat onboarding).
-- 2. "board_columns" di versi lama dihapus dari sini karena ternyata tidak
--    pernah dibaca kode manapun — status kolom kanban sekarang sepenuhnya
--    diatur dari statusLabels di lib/labels/sectors.ts. Digantikan
--    "custom_fields" yang benar-benar dipakai lewat Custom Field Builder.
-- 3. Skrip ini menghapus lalu menulis ulang seluruh isi sector_templates
--    (idempotent, aman dijalankan berkali-kali) — karena tabel ini belum
--    punya unique constraint, jadi re-run "INSERT ... ON CONFLICT" saja
--    akan membuat baris duplikat. JANGAN jalankan ini kalau kamu sudah
--    mengubah/menambah baris sector_templates secara manual di production
--    dan ingin mempertahankan perubahan itu.

delete from sector_templates;

insert into sector_templates (sector_type, template_name, default_structure) values
('sekolah', 'Struktur Sekolah Standar', '{
  "teams": ["Kelas 7A", "Kelas 8A", "Kelas 9A"],
  "custom_fields": [
    { "field_label": "Nilai", "field_type": "number", "is_required": false }
  ]
}'),
('klinik', 'Struktur Klinik Standar', '{
  "teams": ["Poli Umum", "Poli Gigi", "Apotek"],
  "custom_fields": [
    { "field_label": "Nama Pasien", "field_type": "text", "is_required": true },
    { "field_label": "Jenis Tindakan", "field_type": "select", "field_options": ["Konsultasi", "Pemeriksaan", "Tindakan", "Kontrol"], "is_required": false }
  ]
}'),
('bisnis', 'Struktur Bisnis Standar', '{
  "teams": ["Marketing", "Operasional", "Keuangan"],
  "custom_fields": [
    { "field_label": "Prioritas", "field_type": "select", "field_options": ["Rendah", "Sedang", "Tinggi"], "is_required": false }
  ]
}'),
('masjid', 'Struktur Masjid Standar', '{
  "teams": ["Kepengurusan Inti", "Divisi Kajian", "Divisi Sosial"],
  "custom_fields": [
    { "field_label": "Jenis Kegiatan", "field_type": "select", "field_options": ["Kajian", "Sosial", "Pemeliharaan", "Keuangan"], "is_required": false }
  ]
}'),
('komunitas', 'Struktur Komunitas Standar', '{
  "teams": ["Divisi Acara", "Divisi Humas", "Divisi Keuangan"],
  "custom_fields": [
    { "field_label": "Jenis Program", "field_type": "select", "field_options": ["Acara", "Sosial", "Internal"], "is_required": false }
  ]
}'),
('lainnya', 'Struktur Umum', '{
  "teams": ["Tim Utama"],
  "custom_fields": []
}')
on conflict do nothing;
