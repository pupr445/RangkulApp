-- Migration 021 — Sync Sector Workflow Defaults
--
-- LATAR BELAKANG (lihat Pembahasan_Workflow_Default_RANGKUL_Lengkap.docx):
-- Organisasi baru pada sektor Klinik (dan sektor lain) masih menerima
-- workflow generik 3 tahap (Terjadwal → Sedang Berlangsung → Selesai),
-- padahal seharusnya menerima workflow spesifik sektor (Terjadwal →
-- Pemeriksaan → Menunggu Hasil → Selesai untuk Klinik, dst).
--
-- AKAR MASALAH ADA 3 LAPIS, migrasi ini memperbaiki lapis ke-3:
--   1. lib/labels/sectors.ts memuat workflow lama sebagai FALLBACK —
--      sudah diperbaiki di kode (lihat commit terkait wave ini).
--   2. supabase/seed.sql sudah punya workflow yang benar sejak awal —
--      TIDAK ADA masalah di source code seed.sql itu sendiri.
--   3. seed.sql TIDAK OTOMATIS ter-apply ke Supabase production kalau
--      belum pernah dijalankan manual — sehingga sector_templates di
--      database production bisa saja masih menyimpan struktur lama.
--      Migrasi inilah yang menjamin data production ikut ter-sinkron,
--      TANPA bergantung pada seseorang ingat menjalankan seed.sql.
--
-- SENGAJA TIDAK MENYENTUH TABEL organizations SAMA SEKALI — organisasi
-- yang sudah ada (baik yang sudah dikustomisasi admin, maupun yang
-- terlanjur dibuat dengan workflow lama) TIDAK diubah oleh migrasi ini.
-- Ini konsisten dengan prinsip "default workflow" vs "custom workflow
-- organisasi" harus tetap terpisah — default hanya berlaku untuk
-- organisasi BARU yang dibuat setelah ini.

-- sector_templates belum punya unique constraint (lihat catatan di
-- seed.sql) — tambahkan dulu supaya upsert di bawah ini aman dan tidak
-- membuat baris duplikat kalau migrasi ini ter-apply lebih dari sekali,
-- ATAU kalau seed.sql pernah dijalankan manual sebelumnya.
delete from sector_templates a using sector_templates b
  where a.sector_type = b.sector_type and a.id > b.id;

alter table sector_templates
  add constraint sector_templates_sector_type_key unique (sector_type);

insert into sector_templates (sector_type, template_name, default_structure) values
('sekolah', 'Struktur Sekolah Standar', '{
  "teams": ["Kelas 7A", "Kelas 8A", "Kelas 9A"],
  "custom_fields": [
    { "field_label": "Nilai", "field_type": "number", "is_required": false }
  ],
  "workflow_stages": [
    { "key": "diberikan", "label": "Diberikan" },
    { "key": "dikerjakan", "label": "Dikerjakan" },
    { "key": "dikumpulkan", "label": "Dikumpulkan" },
    { "key": "dinilai", "label": "Dinilai" },
    { "key": "selesai", "label": "Selesai" }
  ]
}'),
('klinik', 'Struktur Klinik Standar', '{
  "teams": ["Poli Umum", "Poli Gigi", "Apotek"],
  "custom_fields": [
    { "field_label": "Nama Pasien", "field_type": "text", "is_required": true },
    { "field_label": "Jenis Tindakan", "field_type": "select", "field_options": ["Konsultasi", "Pemeriksaan", "Tindakan", "Kontrol"], "is_required": false }
  ],
  "workflow_stages": [
    { "key": "terjadwal", "label": "Terjadwal" },
    { "key": "pemeriksaan", "label": "Pemeriksaan" },
    { "key": "hasil", "label": "Menunggu Hasil" },
    { "key": "selesai", "label": "Selesai" }
  ]
}'),
('bisnis', 'Struktur Bisnis Standar', '{
  "teams": ["Marketing", "Operasional", "Keuangan"],
  "custom_fields": [
    { "field_label": "Prioritas", "field_type": "select", "field_options": ["Rendah", "Sedang", "Tinggi"], "is_required": false }
  ],
  "workflow_stages": [
    { "key": "lead", "label": "Lead" },
    { "key": "follow_up", "label": "Follow Up" },
    { "key": "negosiasi", "label": "Negosiasi" },
    { "key": "deal", "label": "Deal" },
    { "key": "selesai", "label": "Selesai" }
  ]
}'),
('masjid', 'Struktur Masjid Standar', '{
  "teams": ["Kepengurusan Inti", "Divisi Kajian", "Divisi Sosial"],
  "custom_fields": [
    { "field_label": "Jenis Kegiatan", "field_type": "select", "field_options": ["Kajian", "Sosial", "Pemeliharaan", "Keuangan"], "is_required": false }
  ],
  "workflow_stages": [
    { "key": "rencana", "label": "Direncanakan" },
    { "key": "persiapan", "label": "Persiapan" },
    { "key": "pelaksanaan", "label": "Pelaksanaan" },
    { "key": "selesai", "label": "Selesai" }
  ]
}'),
('komunitas', 'Struktur Komunitas Standar', '{
  "teams": ["Divisi Acara", "Divisi Humas", "Divisi Keuangan"],
  "custom_fields": [
    { "field_label": "Jenis Program", "field_type": "select", "field_options": ["Acara", "Sosial", "Internal"], "is_required": false }
  ],
  "workflow_stages": [
    { "key": "rencana", "label": "Direncanakan" },
    { "key": "persiapan", "label": "Persiapan" },
    { "key": "pelaksanaan", "label": "Pelaksanaan" },
    { "key": "selesai", "label": "Selesai" }
  ]
}'),
('lainnya', 'Struktur Umum', '{
  "teams": ["Tim Utama"],
  "custom_fields": [],
  "workflow_stages": [
    { "key": "todo", "label": "Belum Dikerjakan" },
    { "key": "doing", "label": "Sedang Dikerjakan" },
    { "key": "done", "label": "Selesai" }
  ]
}')
on conflict (sector_type) do update
  set default_structure = excluded.default_structure,
      template_name = excluded.template_name;
