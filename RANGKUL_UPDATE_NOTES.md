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

## Wave 2 — Team Access & Activity Hardening (14 Aug 2026)

- Added `supabase/migrations/015_team_access_and_activity_hardening.sql`.
- Task RLS is now team-aware: tasks linked to a team are visible/editable only to that team's members or organization Owner/Manager.
- Task creation also validates that an assignee belongs to the selected team (unless Owner/Manager).
- Added activity log events for adding/removing team members.
- Added activity log events for general task edits, assignee changes, and team changes.
- This wave deliberately builds on the existing Activity Log, Notification, Team Membership, and Sector Configuration Engine rather than replacing them.
- Full dependency-based typecheck could not be rerun in this clean ZIP extraction because `node_modules` is not present and package installation was unavailable in the current runtime. The changed TypeScript was reviewed and the migration is included for execution in Supabase.


## Wave 3 — Notification Center
- Menambahkan halaman `/dashboard/notifications` sebagai pusat notifikasi lengkap.
- Filter: Semua, Belum dibaca, Penugasan, Mention, Pesan, Status, Deadline.
- Realtime notification tetap menggunakan Supabase Realtime.
- Menambahkan tombol `Lihat semua notifikasi` pada dropdown bell.
- Menambahkan migration `016_notification_deadline_and_audit.sql` untuk tipe notifikasi `deadline` dan index tambahan.
- Menambahkan helper `fetchUnreadNotificationCount`.
- Reminder deadline otomatis terjadwal belum dinyatakan selesai; migration ini hanya menyiapkan skema. Scheduled job dapat ditambahkan pada wave berikutnya.

## Wave 3 — Typecheck Hotfix
- Menambahkan tabel `notifications` secara eksplisit pada `Database.public.Tables` di `lib/types/database.ts`.
- Perubahan ini memperbaiki typed Supabase client agar `supabase.from("notifications").update(...)` tidak lagi menghasilkan parameter bertipe `never`.
- Error yang dilaporkan pada `app/dashboard/notifications/page.tsx:68` (`TS2345`) ditargetkan langsung oleh hotfix ini.
- Setelah ZIP ini dipakai di mesin development, jalankan `npm install` lalu `npm run typecheck` untuk verifikasi penuh dengan dependency lokal.


## Wave 3 Typecheck Hotfix v3 — 2026-08-14
- Replaced the loose `notifications` table type with an explicit Supabase-compatible table definition.
- Added Row/Insert/Update/Relationships typing for `notifications` so `.update({ is_read: true })` is not inferred as `never`.
- Retained the generic loose typing for legacy tables to avoid unrelated refactors.


## Wave 3 Typecheck Hotfix v4
- Removed the catch-all string index signature from `Database.public.Tables` in `lib/types/database.ts`.
- Added all concrete tables used by the application explicitly, including `notifications`.
- Removed stale `tsconfig.tsbuildinfo` from the package to avoid carrying cached compiler state between machines.
- This is intended to fix Supabase typed-client inference that reduced `.update()` payloads to `never`.


## Wave 3 Typecheck Hotfix v5
- Memindahkan operasi `notifications.update({ is_read: true })` dari page component ke helper `markNotificationsRead` di `lib/data/notifications.ts` menggunakan pola akses data yang sama dengan helper notifikasi lainnya.
- Tujuannya menghindari inferensi `never` pada Supabase typed client di halaman Notification Center.


## Wave 3 Cloudflare deployment fix
- Added `export const runtime = "edge";` to `app/dashboard/notifications/page.tsx` so `/dashboard/notifications` is compatible with Cloudflare Pages / next-on-pages Edge Runtime.


## Cloudflare Wave 3 follow-up fix
- Converted `/dashboard/notifications` to an Edge-runtime Server Component wrapper.
- Moved the interactive Notification Center UI into `notifications-client.tsx` with `"use client"`.
- This keeps React client hooks in a Client Component while satisfying Cloudflare `next-on-pages` Edge runtime requirements.

## Wave 4 — Deadline Reminder & Leader Dashboard
- Menambahkan `supabase/migrations/017_deadline_reminders.sql` dengan `entity_type`, `entity_id`, `dedupe_key`, unique index deduplikasi, dan index entitas pada notifications.
- Menambahkan `app/api/cron/deadline-reminders/route.ts` (Edge Runtime) untuk membuat reminder H-1 dan hari-H kepada assignee task.
- Reminder menggunakan `dedupe_key` agar scheduler aman dipanggil berulang tanpa membuat notifikasi ganda.
- Endpoint dilindungi `CRON_SECRET`; dapat dipanggil melalui `x-cron-secret` atau Bearer token.
- Menambahkan `lib/data/leader-dashboard.ts` dan `components/LeaderSummary.tsx`.
- Dashboard utama sekarang menampilkan Ringkasan Pimpinan untuk Owner/Manager: total, selesai, terlambat, due hari ini, jumlah anggota, completion rate, dan aktivitas terbaru.
- Reminder deadline belum menjadi scheduler otomatis sampai endpoint tersebut dijalankan berkala oleh Cloudflare Worker Cron atau scheduler eksternal.

### Wave 4 — Scheduler Cloudflare untuk Deadline Reminder
- Menambahkan `workers/deadline-reminder/index.ts` sebagai Worker dengan `scheduled()` handler.
- Menambahkan `wrangler.deadline-reminder.toml` dengan Cron Trigger hourly (`0 * * * *`, UTC).
- Menambahkan script `deadline-reminder:deploy`.
- Scheduler memanggil endpoint `/api/cron/deadline-reminders` pada deployment RANGKUL dengan `x-cron-secret`.
- Ini adalah Worker scheduler terpisah dari Cloudflare Pages; Pages tetap menjadi aplikasi utama, Worker menangani jadwal. Cron Triggers berjalan pada UTC.


## Wave 4 typecheck hotfix

Memperbaiki typecheck project karena `workers/deadline-reminder/index.ts` mereferensikan `ScheduledController` tanpa type definition yang tersedia pada tsconfig root. Parameter scheduler sekarang ditipkan sebagai `unknown` karena controller tidak digunakan oleh handler. Ini tidak mengubah perilaku runtime Cloudflare Cron.

## Wave 5 — Undangan via WhatsApp (Quick Win Fase 2)
- Menambahkan tombol `Kirim via WhatsApp` pada halaman Anggota Tim setelah undangan berhasil dibuat.
- Menambahkan tombol `Salin Pesan` untuk alur manual jika admin tidak langsung membuka WhatsApp.
- Pesan WhatsApp berisi organisasi, role, email penerima, dan deep-link ke `/login?email=...`.
- Halaman login membaca parameter email dari link undangan dan menampilkan instruksi agar penerima menggunakan akun Google yang sesuai.
- Tidak menambah migration database karena pendekatan ini memakai invitation yang sudah ada; penerimaan tetap menggunakan mekanisme auto-join berbasis email yang sudah berjalan.
\n\n## Wave 5 Hotfix — Login Suspense\n- Memisahkan /login menjadi Server Component wrapper + Client Component.\n- useSearchParams sekarang berjalan di bawah React Suspense agar production prerender tidak gagal.\n- UI/auth flow tetap di login-client.tsx dengan "use client".\n