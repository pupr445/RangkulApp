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

## Wave 6 — Advanced Reporting & Team Insights
- Menambahkan `components/ReportsInsights.tsx`.
- Laporan sekarang memiliki insight distribusi workflow per tahap.
- Menambahkan kesehatan tenggat: terlambat, jatuh tempo hari ini, dan tanpa tenggat.
- Menambahkan workload per tim dengan completion rate dan jumlah task terlambat.
- Menambahkan filter laporan berdasarkan tim.
- Tidak menambah migration database; fitur menggunakan data task, team, dan workflow yang sudah ada.


## Wave 7 — Workflow Engine Strengthening
- Workflow stage sekarang mendukung `color`, `initial`, `final`, dan `transitions`.
- Workflow Builder memungkinkan mengatur warna tahap, tahap awal, tahap akhir, dan status tujuan yang diizinkan.
- Validasi workflow menjaga tepat satu tahap awal, minimal satu tahap akhir, dan membersihkan transition yang tidak valid.
- Board Kanban sekarang menghormati transition rules dan menolak perpindahan status yang tidak diizinkan.
- Task Detail juga memvalidasi perubahan status terhadap transition rules.
- New Task menggunakan initial workflow stage dan menampilkan warna status sesuai konfigurasi.
- Tidak menambah migration database; konfigurasi tetap disimpan pada `organizations.workflow_stages` JSONB yang sudah tersedia.


## Wave 7 Workflow UI Fix
- Mengganti dropdown kode hex pada Workflow Manager menjadi palette warna visual.
- Admin memilih warna dengan klik swatch; kode warna tidak ditampilkan sebagai input.
- Setiap swatch memiliki nama, tooltip, dan state terpilih yang jelas.
- Warna tetap disimpan sebagai nilai internal workflow agar konsisten dengan Kanban dan reporting.


## Wave 7 UI refinement — compact workflow color picker
- Mengganti palette warna inline pada setiap workflow stage menjadi tombol ikon warna kecil.
- Palette dibuka sebagai popover saat ikon diklik, sehingga tidak lagi menambah lebar card workflow.
- Popover tertutup setelah warna dipilih.
- Kontrol stage dibuat wrap-friendly untuk layar desktop maupun sempit.


## Workflow Save Feedback Fix
- Menambahkan feedback visual saat menyimpan workflow: `Menyimpan…` → `✓ Workflow tersimpan` / `Tersimpan`.
- Status tersimpan di-reset ketika ada perubahan workflow baru.
- Error penyimpanan tetap ditampilkan dengan role alert.


## Wave 8 — Activity & Security Audit System
- Memisahkan Activity Log operasional dan Security Audit.
- Menambahkan `team_id` pada `activity_logs` untuk filtering berbasis tim.
- Menambahkan tabel `security_audit_logs` dengan RLS: hanya Owner/Manager yang dapat membaca/menulis audit.
- Menambahkan filtering Activity: target type, anggota, tim, tanggal mulai/akhir.
- Menambahkan filtering Security Audit: aksi, anggota, tim, tanggal.
- Menambahkan tab `Audit Keamanan` pada halaman Aktivitas untuk Owner/Manager.
- Menambahkan audit untuk invitation, perubahan membership tim, workflow update, dan template create/apply.
- Menambahkan index Activity/Audit untuk organisasi, actor, team, target/action.
- Migration baru: `018_activity_audit_system.sql`.
- Full typecheck/build belum diverifikasi di environment ini karena dependency lokal tidak lengkap; source sudah diperiksa secara struktural.


## Wave 8 — Typecheck Hotfix
- Memperbaiki typing `organization_members` pada Activity page agar tidak menghasilkan `never`.
- Menghapus property `teamId` duplikat pada TeamsManager.

## Wave 8 — Perbaikan Menyeluruh (bukan tambal `as any`)
- Upgrade `@supabase/ssr` dari `^0.5.2` ke `^0.12.4`. Root cause bug "Argument of type ... not assignable to type 'never'" adalah ketidakcocokan versi generic antara `@supabase/ssr` lama dan `@supabase/supabase-js` baru (2.112.x) — BUKAN kesalahan tipe `Database` di project ini.
- Menghapus SEMUA workaround `as any`/`(supabase as any)` di 15 file (app/api/invite, app/onboarding, TaskDetailModal, TeamsManager, Chat, WorkflowManager, SettingsForm, LabelOverridesManager, TemplateManager, Board, NotificationBell, TaskList, CustomFieldsManager, NewTaskModal, lib/data/org.ts). Type-safety penuh untuk semua operasi tulis Supabase kembali aktif.
- `logSecurityAudit` dipindahkan dari insert langsung di client menjadi endpoint server baru `POST /api/audit-log` yang memakai service role (`createAdminClient`). Endpoint ini memverifikasi sesi login dan keanggotaan organisasi sebelum menulis, sehingga baris audit tidak lagi bisa gagal diam-diam hanya karena sesi client tidak lolos RLS `security_audit_insert_managers`.
- Semua pemanggil `logSecurityAudit(...)` diperbarui: parameter `supabase` di awal dihapus (tidak diperlukan lagi karena penulisan sekarang lewat fetch ke endpoint server, bukan client Supabase langsung).
- Diverifikasi ulang: `npm run typecheck` lolos bersih tanpa `as any`, `npm run build` berhasil compile (gagal prerender `/login` di lingkungan tanpa `.env` adalah perilaku yang sudah diketahui, bukan regresi).

## Wave 9 — Notification Engine (Fase 5 Roadmap)
Melengkapi Notification Rules & Notification Preferences yang sebelumnya jadi celah paling terasa.

**Migration baru:** `019_notification_engine.sql`
- Tabel baru `notification_email_prefs` (1 baris per user, RLS `user_id = auth.uid()`) — sengaja dipisah dari `organization_members` karena Owner organisasi tidak selalu punya baris di sana.
- Kolom `notifications.emailed_at` + index parsial untuk antrean digest worker.
- Tipe notifikasi baru: `invitation`, `overdue`.

**Aturan notifikasi baru:**
- **Invitation** — yang mengundang diberi tahu saat undangannya diterima & anggota baru bergabung (`lib/data/org.ts`).
- **Overdue** — pengingat berulang tiap 3 hari untuk tugas yang sudah lewat tenggat & belum di stage final, digabung ke endpoint `app/api/cron/deadline-reminders` yang sudah ada (bukan worker baru — reuse infra).

**Preferensi email notifikasi:**
- Halaman baru `/dashboard/notifications/preferences`, komponen `NotificationPreferences.tsx` — toggle per tipe notifikasi, default semua OFF (opt-in, bukan opt-out).
- Endpoint baru `app/api/cron/notification-digest` + worker `rangkul-notification-digest` (setiap 15 menit) — mengirim SATU email ringkasan per user (bukan satu email per notifikasi), hanya untuk tipe yang diaktifkan user, lewat Resend (reuse pattern dari fitur invite).
- Kalau `RESEND_API_KEY`/`RESEND_FROM_EMAIL` belum diisi, notifikasi tetap ditandai "diproses" (jujur, tidak retry selamanya) tapi tidak pura-pura terkirim.

**Belum dikerjakan (sengaja discope keluar dari wave ini):** Web Push notification — butuh VAPID keys, service worker, dan UX permission browser yang jauh lebih besar dari sisa item Fase 5; akan dikerjakan terpisah supaya kualitasnya tidak dikompromikan demi buru-buru selesai.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 9.1 — Hotfix: middleware memblokir semua endpoint /api/cron
Bug kritis ditemukan lewat pengujian langsung: middleware.ts mengalihkan SEMUA request tanpa sesi login ke /login — termasuk panggilan dari Cloudflare Cron Trigger yang memang tidak pernah punya cookie sesi (autentikasinya lewat header `x-cron-secret`, dicek di dalam kode masing-masing route, bukan lewat middleware). Akibatnya endpoint `/api/cron/deadline-reminders` dan `/api/cron/notification-digest` SELALU membalas 307 redirect ke /login, tidak pernah benar-benar mengecek secret atau menjalankan logikanya — ini akar penyebab worker rangkul-deadline-reminder menunjukkan "19 requests, 19 errors" di dashboard Cloudflare.

**Fix:** `/api/cron` ditambahkan ke PUBLIC_PATHS di middleware.ts, sehingga middleware tidak lagi ikut campur pada path ini — autentikasi endpoint cron sepenuhnya diserahkan ke pengecekan `x-cron-secret` di dalam masing-masing route handler, sesuai desain awal.

Diverifikasi: `npm run typecheck` lolos bersih.

## Wave 10 — Task Engine (Fase 2 Roadmap)
Melengkapi 4 fitur inti Task Engine yang sebelumnya kosong: Subtask/Checklist, Task Dependency, Task Template, Task Watcher.

**Migration baru:** `020_task_engine.sql`
- `task_checklist_items` — subtask/checklist per task, RLS mengikuti akses ke task induknya (reuse `can_access_team`).
- `task_dependencies` — relasi "task A diblokir oleh task B", validasi tidak bisa self-reference.
- `task_templates` — blueprint task (judul, tag, checklist, custom field) yang bisa dipakai ulang cepat.
- `task_watchers` — user bisa "mengikuti" task tanpa harus jadi assignee, RLS: siapa pun anggota tim yang task-nya bisa dilihat, boleh lihat daftar watcher; tapi hanya bisa tambah/hapus DIRINYA SENDIRI sebagai watcher.

**Kode baru:**
- `lib/data/task-engine.ts` — helper CRUD untuk keempat fitur di atas.
- `components/TaskEngineWidgets.tsx` — `TaskChecklist`, `TaskDependencies`, `TaskWatchToggle`, dipasang di `TaskDetailModal.tsx` (Board, TaskList, CalendarView semua diperbarui untuk meneruskan `allTasks` sebagai pemilih dependency).
- `NewTaskModal.tsx` — dropdown "Mulai dari template" (isi form + checklist otomatis dari template), dan opsi "Simpan isian ini sebagai template".

**Aturan baru:** task tidak bisa dipindahkan ke stage FINAL kalau masih ada dependency yang belum selesai — divalidasi di `TaskDetailModal.handleSave` sebelum update dikirim ke database, dengan pesan error yang jelas.

**Notifikasi:** perubahan status task sekarang juga memberi tahu SEMUA watcher-nya (bukan cuma assignee), lewat tipe notifikasi `status_changed` yang sudah ada.

**Sengaja belum dikerjakan (discope keluar):** badge progres checklist ("3/5") di kartu Kanban — butuh query batch di level server supaya tidak N+1, akan dikerjakan sebagai peningkatan performa terpisah, bukan buru-buru sekarang.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 11 — Sector Workflow Consistency (perbaikan fondasi, bukan fitur baru)
Menindaklanjuti laporan "Pembahasan Workflow Default RANGKUL" — dikonfirmasi akurat 100% setelah diverifikasi langsung terhadap source code. Organisasi baru pada sektor Klinik (dan sektor lain) menerima workflow generik 3 tahap, bukan workflow spesifik sektor yang sudah dirancang.

**Akar masalah (3 lapis, sesuai laporan):**
1. `lib/labels/sectors.ts` menyimpan workflow LAMA sebagai fallback (Klinik: Terjadwal→Sedang Berlangsung→Selesai) — sementara `supabase/seed.sql` sudah punya workflow yang benar (Terjadwal→Pemeriksaan→Menunggu Hasil→Selesai). Fallback inilah yang aktif setiap kali `organizations.workflow_stages` kosong/tidak valid.
2. `seed.sql` tidak otomatis ter-apply ke Supabase production — jadi walau source code benar, `sector_templates` di database production bisa saja masih menyimpan struktur lama (atau kosong sama sekali).
3. Onboarding preview tidak menampilkan workflow sama sekali (cuma tim & custom field) — padahal workflow adalah pembeda paling penting dari Sector Adaptation Engine.

**Perbaikan:**
- `lib/labels/sectors.ts` — `workflowStages` untuk Sekolah, Klinik, Bisnis, Masjid, Komunitas diperbarui agar identik dengan `seed.sql` (Sekolah & Bisnis sekarang 5 tahap, Klinik & Masjid/Komunitas 4 tahap). Sektor "Lainnya" sengaja dibiarkan generik 3 tahap (memang dirancang sebagai fallback kustom).
- **Migration baru `021_sync_sector_workflow_defaults.sql`** — menambahkan unique constraint `sector_type` yang selama ini belum ada (disebut sebagai risiko di komentar `seed.sql`), lalu upsert `sector_templates` dengan workflow terbaru. **Sengaja sama sekali tidak menyentuh tabel `organizations`** — organisasi yang sudah ada (baik yang sudah dikustomisasi admin maupun yang terlanjur dapat workflow lama) tidak diubah paksa oleh migrasi ini, sesuai prinsip "default workflow" vs "custom workflow organisasi" harus tetap terpisah.
- `app/onboarding/page.tsx` — preview sekarang menampilkan alur kerja default secara visual (rangkaian tahap dengan panah) sebelum organisasi dibuat, dengan fallback ke `SECTOR_LABELS` dari kode kalau `sector_templates` di database ternyata belum ter-sync (defense in depth, bukan cuma mengandalkan migrasi berhasil jalan).
- Konsistensi Kanban → Task → Notification → Reporting tidak perlu perbaikan terpisah — semuanya sudah membaca dari sumber yang sama (`organizations.workflow_stages`), jadi otomatis ikut benar begitu sumber datanya benar.

**PENTING — organisasi LAMA yang sudah kadung dibuat dengan workflow 3-tahap tidak otomatis berubah** (sesuai desain, lihat di atas). Kalau organisasi test/demo kamu sendiri perlu di-reset ke workflow sektor yang benar, itu perlu tindakan manual terpisah (update `workflow_stages` organisasi itu lewat Pengaturan atau SQL manual) — BUKAN dengan menjalankan ulang migrasi ini.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 12 — Daily/Weekly Automation Summary (Fase 15 Roadmap)
Ringkasan otomatis untuk Owner & Manager tiap organisasi, memakai pola Cloudflare Worker scheduler yang sudah terbukti jalan dari fitur deadline-reminder.

**Migration baru:** `022_notification_summary_type.sql` — tambah tipe notifikasi `summary`.

**Endpoint baru:** `app/api/cron/daily-summary` — satu endpoint dipakai untuk harian MAUPUN mingguan (dibedakan lewat `?period=daily|weekly`), supaya logikanya tidak ditulis dua kali. Untuk tiap organisasi yang punya minimal satu task: hitung total/selesai/terlambat/jatuh tempo hari ini, kirim satu notifikasi ke Owner + semua Manager organisasi itu (bukan ke semua anggota — ini laporan level pemimpin, konsisten dengan Leader Dashboard). Organisasi kosong dilewati.

**Worker baru:**
- `rangkul-daily-summary` — jalan tiap hari jam 23:00 UTC (06:00 WIB).
- `rangkul-weekly-summary` — jalan tiap Senin jam 23:00 UTC (06:00 WIB Senin).
Keduanya memanggil endpoint yang sama, cuma beda parameter `period`.

**Refactor kecil:** `resolveFinalStageKey` yang tadinya cuma ada di endpoint deadline-reminders sekarang jadi helper bersama di `lib/data/workflow-final-stage.ts`, dipakai juga oleh daily-summary — menghindari duplikasi logika penentuan "stage mana yang berarti selesai".

**Catatan scope yang disengaja:** ringkasan ini adalah SNAPSHOT kondisi saat ini (total/selesai/terlambat/jatuh tempo), BUKAN delta "apa yang berubah sejak kemarin" — karena tabel `tasks` belum punya kolom `updated_at`/`completed_at` untuk melacak itu secara akurat. Delta yang lebih detail bisa jadi peningkatan terpisah nanti, bukan dipaksakan sekarang dengan asumsi yang tidak akurat.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 13 — Hotfix: error login Google disembunyikan diam-diam
Bug ditemukan lewat video: login dengan akun Google terpental balik ke halaman login TANPA pesan error apa pun, walau /auth/callback sebenarnya sudah mendeteksi kegagalan (mengirim ?error=auth_callback_failed di URL redirect) — halaman login-nya tidak pernah membaca/menampilkan parameter itu.

**Fix:**
- `app/auth/callback/route.ts` — sekarang menyertakan pesan error asli dari Supabase (`error.message`) di URL redirect sebagai parameter `reason`, juga meneruskan `error_description` dari Google/Supabase kalau OAuth gagal di level provider (mis. user membatalkan).
- `app/(auth)/login/login-client.tsx` — menampilkan pesan error tersebut ke user dengan jelas, alih-alih diam-diam kembali ke form kosong.

**PENTING — ini memperbaiki GEJALA (error tersembunyi), BUKAN NECESSARILY akar penyebab kenapa login gagal.** Kemungkinan besar akar masalahnya ada di KONFIGURASI Supabase/Google Cloud Console (bukan bug kode), cek ini:
1. Supabase Dashboard → Authentication → URL Configuration → pastikan `https://rangkulapp.pages.dev/auth/callback` ada di "Redirect URLs" (bukan cuma Site URL).
2. Google Cloud Console → Credentials → OAuth Client → "Authorized redirect URIs" harus berisi `https://<project-ref>.supabase.co/auth/v1/callback` (domain Supabase, BUKAN domain RANGKUL — Google redirect ke Supabase dulu, baru Supabase redirect ke RANGKUL).
3. Kalau salah satu belum benar, sekarang errornya akan TERLIHAT di halaman login setelah Wave 13 ini di-deploy — pesan itu akan langsung menunjukkan akar masalah sebenarnya, tinggal dikirim ke Claude untuk diagnosis lanjutan.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 14 — Chat Engine lanjutan (Fase 7 Roadmap)
Melengkapi Chat: Thread/Reply, Pin Message, Message Permission. Mention & Read Receipt sudah ada sejak sebelumnya, tidak diulang.

**Migration baru:** `023_chat_engine.sql`
- `messages.reply_to_id` — balasan ke pesan lain, tampil sebagai quote di dalam bubble.
- Tabel baru `message_pins` — sengaja terpisah dari `messages` (bukan kolom `is_pinned`) supaya izin pin diatur lewat RLS insert/delete tabel ini, TANPA perlu membuka izin UPDATE pada konten pesan itu sendiri (yang memang sengaja tidak bisa diedit siapa pun, termasuk pengirimnya).
- Policy `messages_delete` baru — pengirim boleh hapus pesannya sendiri (channel maupun DM); Owner/Manager boleh hapus pesan siapa pun di Diskusi Umum/Tim untuk moderasi, TAPI TIDAK BOLEH menghapus pesan DM orang lain (privasi percakapan pribadi tetap dijaga).

**Aturan pin yang disengaja:** di Diskusi Umum/Tim, hanya Owner/Manager yang boleh pin (mencegah spam pin di ruang bersama). Di chat privat, kedua pihak DM boleh pin pesan masing-masing.

**UI (`components/Chat.tsx`):**
- Tombol "Balas" muncul saat hover pesan → menampilkan preview kutipan di atas kolom input → pesan baru tersimpan dengan `reply_to_id`, ditampilkan sebagai quote yang bisa diklik untuk scroll ke pesan asli.
- Strip "📌 Disematkan" di atas daftar pesan, menampilkan semua pesan yang di-pin di percakapan itu, bisa diklik untuk scroll langsung.
- Tombol "Hapus" muncul sesuai izin (constraint UI-nya cocok persis dengan RLS `messages_delete` — bukan cuma disembunyikan di UI tapi juga ditegakkan di database).

**Sengaja belum dikerjakan (di luar scope wave ini):** file attachment di chat, message search. Keduanya butuh desain terpisah (attachment: storage + preview; search: full-text search index), akan dikerjakan sebagai wave sendiri supaya tidak dikompromikan kualitasnya.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 15 — Custom Field & Template Maturity (Fase 9 & 10 Roadmap)

**Migration baru:** `024_custom_field_template_maturity.sql`
- `custom_fields.depends_on_field_key` + `depends_on_value` — Conditional Field: field hanya tampil/wajib kalau field lain bernilai tertentu.
- `custom_fields.visible_to` + `editable_by` (array role) — Field Permission: siapa boleh lihat/isi field ini. Default semua role, jadi field lama tidak tiba-tiba hilang dari siapa pun.
- `organization_templates.version` — Template Versioning: nama yang sama dipakai lagi jadi versi baru, bukan menimpa. Histori lama tetap tersimpan & bisa diterapkan lagi.
- **Perbaikan celah RLS**: `org_templates_all` yang lama mengizinkan SEMUA anggota (termasuk member biasa) membuat/mengubah/menghapus template — padahal ini mengubah struktur workflow & field ORG-WIDE begitu diterapkan. Diperketat jadi manager-only untuk insert/update/delete (select tetap terbuka untuk semua member). Tidak berdampak ke UI yang sudah ada karena halaman Settings memang sudah mengalihkan member biasa sebelum sempat melihat komponen ini — jadi ini murni menutup celah di level API/database, bukan mengubah perilaku yang terlihat.

**Custom Field UI (`CustomFieldsManager.tsx`):**
- Bagian baru "Field bersyarat" — pilih field acuan + nilai syaratnya.
- Bagian baru "Siapa boleh lihat & isi" — checkbox per role (Owner/Manager/Member), dengan validasi otomatis: role yang tidak boleh lihat otomatis tidak boleh isi.
- Badge "Bersyarat" dan "Terbatas: ..." muncul di daftar field kalau relevan.

**Task modal (`NewTaskModal.tsx`, `TaskDetailModal.tsx`):** field yang tidak `visible_to` role user sekarang otomatis disembunyikan; field yang kondisinya belum terpenuhi juga disembunyikan; field yang tidak `editable_by` role user tetap terlihat tapi disabled (transparan, bukan hilang begitu saja — supaya user tahu field itu ada tapi bukan wewenangnya). Validasi wajib-isi otomatis mengabaikan field yang sedang disembunyikan.

**Template UI (`TemplateManager.tsx`):**
- Tombol "Duplikat" — isi ulang form dengan nama "{nama} (salinan)" dari template yang dipilih, siap diedit sebelum disimpan.
- "Riwayat versi" — bisa dibuka per nama template, menampilkan versi-versi lama beserta tanggalnya, masing-masing tetap bisa diterapkan atau dihapus individual.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 16 — Pisahkan System Role, Sector Position, Sector Entity
Menindaklanjuti laporan QA "Temuan_QA_Role_Sector_Position_RANGKUL_Lengkap.docx" — dikonfirmasi akurat 100% setelah diverifikasi ke source code. Label sektoral (mis. Klinik: "Dokter Kepala"/"Dokter"/"Pasien") sebelumnya dipakai LANGSUNG sebagai identitas header DAN pilihan dropdown undang anggota — mencampur System Role, Sector Position, dan Sector Entity jadi satu konsep.

**Akar masalah:** `ownerRole`/`managerRole`/`memberRole` di `lib/labels/sectors.ts` awalnya didesain sebagai label deskriptif saja, tapi terpakai di dua tempat yang salah: `TopBar.tsx` (identitas user di header — SELALU menampilkan `ownerRole`, "Dokter Kepala", untuk SIAPA PUN yang login) dan `TeamManager.tsx` (dropdown undang anggota — literally menampilkan "Pasien" sebagai pilihan System Role).

**Migration baru:** `025_sector_position.sql`
- `organizations.owner_sector_position`, `organization_members.sector_position`, `invitations.sector_position` — kolom baru terpisah dari `role` (System Role: owner/manager/member, TIDAK diubah).

**`lib/labels/sectors.ts`:** field baru `sectorPositions: string[]` per sektor — preset posisi sektoral yang REALISTIS (Klinik: Dokter Kepala/Dokter/Perawat/Bidan/Apoteker/Admin Klinik/dst — **tanpa Pasien**, karena itu data/entitas sektor bukan posisi anggota internal). `ownerRole`/`managerRole`/`memberRole` DIPERTAHANKAN tapi didokumentasikan ulang sebagai label deskriptif SAJA — tidak lagi dipakai untuk identitas atau dropdown.

**`TopBar.tsx`:** identitas header sekarang menampilkan `{sectorPosition} · {SystemRole generik}` (mis. "Budi Santoso — Dokter Kepala · Owner"), bukan cuma `labels.ownerRole` untuk semua orang. System Role ditampilkan dengan istilah universal (Owner/Manager/Member), bukan istilah sektoral.

**`TeamManager.tsx`:** form undang anggota sekarang punya DUA dropdown terpisah — "Role Sistem" (Owner/Manager/Member, menentukan hak akses) dan "Posisi Sektor" (opsional, dari preset `sectorPositions`, murni jabatan — tidak memengaruhi izin akses). Daftar Anggota Aktif & Menunggu Bergabung menampilkan keduanya terpisah.

**Bug terkait yang ditemukan & ikut diperbaiki:** `app/dashboard/team/page.tsx` sebelumnya SELALU menambahkan viewer halaman sebagai "Owner" di posisi pertama daftar anggota, TANPA mengecek apakah viewer itu benar-benar owner — akibatnya manager/member yang membuka halaman ini akan melihat dirinya sendiri muncul DUA KALI, sekali dengan label "Owner" yang salah. Sekarang entri sintetis itu hanya ditambahkan kalau `role === "owner"` sungguhan.

**Keterbatasan yang diketahui (belum diselesaikan penuh):** dengan perbaikan di atas, saat manager/member membuka halaman Anggota Tim, Owner organisasi TIDAK ikut muncul di daftar (karena Owner tidak selalu punya baris di `organization_members`, dan kita sengaja tidak mengubah pola arsitektur itu di wave ini untuk membatasi risiko). Perbaikan penuh untuk ini butuh keputusan arsitektur terpisah (mis. selalu membuat baris `organization_members` untuk Owner saat organisasi dibuat) — dicatat sebagai pekerjaan lanjutan, bukan dipaksakan sekarang.

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.

## Wave 17 — File & Document Maturity (Fase 13 Roadmap)
Sebelumnya file HANYA disimpan di Supabase Storage tanpa metadata sama sekali (daftar file didapat langsung dari storage.list()) — tidak ada folder, versi, atau kontrol siapa boleh hapus (siapa pun anggota organisasi bisa hapus file siapa saja).

**Migration baru:** `026_document_folder_version_permission.sql`
- Tabel baru `document_folders` — folder bersarang (subfolder di dalam subfolder), RLS: semua member bisa lihat & buat, hapus hanya pembuatnya atau Owner/Manager.
- Tabel baru `documents` — lapisan metadata DI ATAS Storage yang sudah ada (bukan mengganti), menyimpan `folder_id`, `file_name`, `root_document_id` + `version` untuk versioning.
- **Perbaikan celah keamanan**: policy `documents_delete` pada `storage.objects` sebelumnya cuma cek `is_org_member` (SIAPA PUN anggota bisa hapus file siapa saja) — diperketat jadi pengunggah aslinya sendiri, atau Owner/Manager untuk moderasi.

**Versioning:** desainnya reuse pola yang sama dengan Template Versioning (Wave 15) — `root_document_id` menandai "keluarga" file, `version` bertambah tiap kali diganti, versi lama tetap tersimpan utuh (bukan ditimpa). "Hapus" menghapus seluruh keluarga versi sekaligus (tidak menyisakan storage object yatim yang tidak bisa diakses).

**Pencarian:** filter nama file lintas SEMUA folder dalam organisasi (bukan cuma folder aktif) — cukup untuk skala dokumen organisasi, sengaja tidak membangun infrastruktur full-text search terpisah yang berlebihan untuk kasus ini.

**UI (`DocsManager.tsx`, ditulis ulang total):**
- Navigasi folder dengan breadcrumb, tombol "+ Folder" untuk subfolder baru.
- Kolom pencarian di atas — lintas folder, hasil menampilkan nama file yang cocok.
- Tombol "Versi baru" per file — mengunggah revisi tanpa kehilangan versi lama.
- Tombol "Riwayat" — modal daftar semua versi dengan tanggal & ukuran, masing-masing bisa diunduh langsung.
- Tombol "Hapus" per file/folder mengikuti RLS yang baru (transparan sesuai izin, bukan disembunyikan tapi tetap bisa lewat API).

Diverifikasi: `npm run typecheck` lolos bersih, `npm run build` berhasil compile.
