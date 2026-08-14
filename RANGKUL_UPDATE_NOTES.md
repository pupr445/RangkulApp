# RANGKUL — Update Notes

## Baseline
ZIP ini merupakan kelanjutan dari baseline RANGKUL terbaru yang dikirim pada 14 Agustus 2026. Tidak ada reset project; perubahan dilakukan di atas codebase yang sudah ada.

## Penguatan yang dikerjakan

### 1. Sector Configuration Engine — Workflow Dinamis
- `organizations.workflow_stages` ditambahkan.
- Workflow tidak lagi terikat hanya pada `todo / doing / done`.
- Pengaturan workflow dapat diubah dari halaman Pengaturan.
- Admin dapat menambah, menghapus, mengubah label, dan mengurutkan tahap.
- Task Board, Task List, Task Detail, task creation, kalender, dan laporan mengikuti workflow organisasi.
- Preset workflow awal sektor disediakan pada seed data.
- Onboarding organisasi baru meng-clone workflow dari template sektor.

Contoh workflow yang sekarang dimungkinkan:
- Klinik: Terjadwal → Pemeriksaan → Menunggu Hasil → Selesai
- Bisnis: Lead → Follow Up → Negosiasi → Deal → Selesai
- Masjid: Direncanakan → Persiapan → Pelaksanaan → Selesai

### 2. Custom Field Builder — Penguatan Penuh
- Edit field.
- Reorder field.
- Dropdown/select.
- Required/optional.
- Minimum/maksimum untuk angka.
- Minimum/maksimum untuk tanggal.
- Validasi nilai ketika task dibuat/diedit.

### 3. Template Organisasi
- Ditambahkan tabel `organization_templates`.
- Admin dapat menyimpan konfigurasi workflow + tim + custom fields sebagai template.
- Template dapat diterapkan kembali tanpa mengubah SQL.
- Saat diterapkan, workflow diganti dan tim/field yang belum ada akan ditambahkan secara non-destruktif.

## Database Migration Baru
- `013_sector_configuration_engine.sql`
- `014_organization_templates.sql`

Migration 013 menambahkan workflow dinamis dan metadata validasi/custom-field ordering.
Migration 014 menambahkan template organisasi yang dapat dikelola melalui UI.

## Verifikasi
- `npm run typecheck` ✅ berhasil.
- Production build belum dapat diverifikasi penuh pada runtime ini karena Next.js membutuhkan binary SWC native yang belum tersedia lokal dan lingkungan eksekusi tidak dapat mengunduh dependency tersebut dari registry.

## Catatan Deployment
Sebelum deploy, jalankan migration 013 dan 014 pada Supabase target. Setelah itu build/deploy menggunakan environment variable yang sesuai.
