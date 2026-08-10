-- Contoh data awal untuk sector_templates.
-- Jalankan setelah schema.sql. Ini opsional — starter tetap berjalan
-- tanpa seed ini karena label default sudah ada di lib/labels/sectors.ts,
-- tabel ini baru relevan saat kamu ingin struktur tim/proyek default
-- ikut otomatis dibuat saat organisasi baru dibuat (Fase 2 di roadmap).

insert into sector_templates (sector_type, template_name, default_structure) values
('sekolah', 'Struktur Sekolah Standar', '{
  "teams": ["Kelas 7A", "Kelas 8A", "Kelas 9A"],
  "board_columns": ["Belum Dikerjakan", "Sedang Dikerjakan", "Selesai"]
}'),
('klinik', 'Struktur Klinik Standar', '{
  "teams": ["Poli Umum", "Poli Gigi", "Apotek"],
  "board_columns": ["Belum Dikerjakan", "Sedang Dikerjakan", "Selesai"]
}'),
('bisnis', 'Struktur Bisnis Standar', '{
  "teams": ["Marketing", "Operasional", "Keuangan"],
  "board_columns": ["Belum Dikerjakan", "Sedang Dikerjakan", "Selesai"]
}')
on conflict do nothing;
