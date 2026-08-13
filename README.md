# RANGKUL — Starter Codebase

Platform manajemen kerja & komunikasi tim yang **tampilannya menyesuaikan otomatis dengan sektor organisasi** (sekolah, klinik, bisnis, masjid, komunitas, dst). Starter ini adalah fondasi MVP — bukan produk jadi — dibangun dengan stack yang sudah kamu pakai: **Next.js + Supabase + Cloudflare + GitHub**.

Lihat juga dokumen konsep produk lengkap (`Konsep-Produk-RANGKUL.docx`) dan wireframe interaktif (`RANGKUL-wireframe.html`) yang dibuat sebelumnya — starter ini adalah implementasi nyata dari konsep di dokumen tersebut.

## Apa yang sudah ada di starter ini

- ✅ **Sector Adaptation Engine** (`lib/labels/sectors.ts`) — mesin inti yang menerjemahkan istilah generik ke istilah per sektor, kini juga mencakup label status/workflow kerja (mis. klinik: "Terjadwal/Sedang Berlangsung/Selesai", masjid: "Direncanakan/Sedang Berjalan/Selesai") — bukan cuma istilah entitas
- ✅ Autentikasi via Supabase (Google OAuth) + middleware proteksi route
- ✅ Wizard onboarding untuk memilih sektor organisasi
- ✅ **Dashboard / Kanban Board** — terhubung ke tabel `tasks`, fallback ke data contoh jika kosong
- ✅ **Semua Tugas/PR** (`/dashboard/tasks`) — daftar tugas lintas tim dengan filter status
- ✅ **Diskusi** (`/dashboard/chat`) — chat real-time via Supabase Realtime dengan 3 jenis percakapan: **Diskusi Umum** (se-organisasi), **Chat per Tim** (channel terpisah untuk tiap tim/kelas/poli, pakai kolom `team_id` yang sejak awal sudah ada di tabel `messages` tapi belum dipakai), dan **Chat Privat (DM)** — plus **@mention** dan indikator "sudah dibaca" untuk DM
- ✅ **Rapor Kinerja** (`/dashboard/reports`) — agregasi status tugas, **breakdown per anggota**, dan **ekspor CSV**
- ✅ **Dokumen** (`/dashboard/docs`) — upload & unduh file sungguhan via Supabase Storage
- ✅ **Kalender** (`/dashboard/calendar`) — tampilan bulanan tugas berdasarkan tenggat (`due_date`), klik tanggal untuk lihat daftar tugasnya, klik tugas untuk edit
- ✅ **Edit & hapus tugas**, ubah status lewat drag & drop maupun dropdown cepat
- ✅ **Anggota Tim** (`/dashboard/team`) — undang anggota lewat email, auto-join saat mereka login dengan email yang diundang
- ✅ **Assign tugas ke anggota tertentu** — dropdown "Ditugaskan ke" di form tugas
- ✅ **Email undangan otomatis** (opsional, lewat Resend — lihat bagian 3 di bawah)
- ✅ **Custom Field Builder per Sektor** (`/dashboard/settings`) — admin bisa tambah kolom data sendiri (Teks, Angka, Tanggal, atau **Pilihan/Dropdown** dengan opsi custom), tandai wajib diisi, dan validasi berjalan otomatis di form tugas (`supabase/migrations/009_custom_field_builder.sql`)
- ✅ **Struktur Tim Majemuk** — satu organisasi bisa punya banyak tim/kelas/poli, tugas bisa dikaitkan & difilter per tim
- ✅ **Kontrol Akses Berjenjang** — Owner/Manager bisa kelola tim/field/undangan, Member biasa cuma bisa ubah tugas miliknya sendiri (ditegakkan lewat RLS database, bukan cuma UI)
- ✅ **Override Manual Istilah** — Owner bisa ganti istilah tertentu manual (mis. "Guru" → "Wali Kelas") tanpa perlu ubah kode, di luar template sektor default
- ✅ **Template Preset per Sektor** — saat onboarding, semua 6 sektor kini punya template siap pakai (`supabase/seed.sql`): tim default OTOMATIS DIBUAT (mis. sekolah langsung dapat Kelas 7A/8A/9A) **dan** field data relevan langsung tersedia lewat Custom Field Builder (mis. klinik langsung dapat field "Nama Pasien" wajib diisi + "Jenis Tindakan" dropdown) — sebelumnya cuma 3 dari 6 sektor yang punya template, dan template lama cuma nama tim tanpa field
- ✅ Skema database PostgreSQL multi-tenant lengkap dengan Row Level Security (`supabase/schema.sql`)
- ✅ Konfigurasi deploy ke Cloudflare Pages + GitHub Actions CI/CD (sudah diuji berhasil deploy end-to-end)

## Yang BELUM ada (langkah lanjutan)

- ❌ Notifikasi push
- ❌ Aktivitas tim harian (log)
- ❌ Halaman billing/subscription (Midtrans/Xendit)
- ❌ Aplikasi mobile

---

## 1. Setup Lokal

### Prasyarat
- Node.js 18.17+ dan npm
- Akun [Supabase](https://supabase.com) (gratis untuk mulai)
- Akun [Cloudflare](https://cloudflare.com) (gratis untuk mulai)
- Akun GitHub

### Langkah

```bash
# 1. Install dependencies
npm install

# 2. Salin environment variable
cp .env.example .env.local
# lalu isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 2. Setup Supabase

1. Buat project baru di [supabase.com/dashboard](https://supabase.com/dashboard).
2. Buka **SQL Editor**, jalankan isi `supabase/schema.sql`.
3. **Jalankan juga `supabase/migrations/002_chat_and_docs.sql`** — kolom untuk fitur Diskusi + bucket Storage untuk Dokumen.
4. **Jalankan juga `supabase/migrations/003_team_members.sql`** — tabel `invitations` + izin auto-join untuk fitur Anggota Tim.
5. **Jalankan juga `supabase/migrations/004_custom_field_values.sql`** — kolom penyimpanan nilai custom field di tabel tugas.
6. **Jalankan juga `supabase/migrations/005_multi_team.sql`** — kolom `team_id` di tabel tugas untuk struktur tim majemuk.
7. **Jalankan juga `supabase/migrations/006_role_based_access.sql`** — kebijakan RLS yang menegakkan hak akses Owner/Manager/Member.
8. **Jalankan juga `supabase/migrations/007_unique_owner.sql`** — mengunci satu akun hanya boleh punya 1 organisasi (cek dulu tidak ada duplikat sebelum menjalankan ini, lihat komentar di file SQL-nya).
9. **Jalankan juga `supabase/migrations/008_private_chat_mentions.sql`** — kolom & tabel untuk Chat Privat (DM) dan status "sudah dibaca".
10. **Jalankan `supabase/seed.sql`** — sebelumnya opsional, sekarang disarankan dijalankan supaya fitur Template Preset (poin di atas) benar-benar terlihat efeknya saat onboarding organisasi baru, untuk SEMUA sektor (sekolah/klinik/bisnis/masjid/komunitas/lainnya). **Butuh migration `009_custom_field_builder.sql` sudah jalan lebih dulu**, karena seed ini juga mengisi custom_fields default. Tanpa seed ini, onboarding tetap jalan normal, cuma tidak ada tim/field yang otomatis dibuat. Catatan: seed ini menghapus lalu menulis ulang seluruh isi tabel `sector_templates` — jangan jalankan kalau kamu sudah mengedit baris template itu secara manual dan ingin mempertahankannya.
11. Aktifkan provider **Google** di **Authentication > Providers**, isi Client ID & Secret dari [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
12. Tambahkan Redirect URL di **Authentication > URL Configuration**: `http://localhost:3000/auth/callback` (dan URL production kamu nanti).
13. Salin `Project URL` dan `anon public key` dari **Project Settings > API** ke `.env.local`.
14. **Salin juga `service_role key`** (di halaman yang sama, di bawah anon key) ke `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` — **wajib**, lihat catatan di bawah.
15. (Opsional, setelah skema stabil) generate tipe TypeScript otomatis:
    ```bash
    npx supabase gen types typescript --project-id <PROJECT_ID> > lib/types/database.ts
    ```

> **Kenapa perlu service_role key untuk sesuatu sesederhana "buat organisasi"?**
> Awalnya pembuatan organisasi memang cukup lewat insert langsung dari browser (memakai RLS biasa, seperti fitur lain di aplikasi ini). Tapi di lapangan ditemukan kasus di mana layanan PostgREST sebuah project Supabase gagal meneruskan konteks otentikasi dengan benar ke RLS untuk operasi INSERT tertentu — meski JWT valid, kebijakan RLS benar, dan `auth.uid()` terbukti bekerja normal saat disimulasikan langsung di database (bukan lewat API). Ini kemungkinan bug/anomali spesifik pada instance PostgREST tertentu, bukan kesalahan konfigurasi. Karena user aplikasi pada umumnya tidak seharusnya terhambat oleh masalah infrastruktur semacam ini, `/api/create-organization` dipindah ke server memakai service role key (yang melewati RLS sepenuhnya) — lebih andal, dan tetap aman karena `owner_id` diambil dari sesi login yang sudah diverifikasi server, bukan dari input yang bisa dipalsukan.

---

## 3. Setup Email Undangan Otomatis (opsional)

Tanpa langkah ini, fitur Anggota Tim tetap berfungsi — undangan tersimpan, tapi kamu perlu kabari orangnya manual. Untuk mengaktifkan pengiriman email otomatis:

1. Daftar gratis di [resend.com](https://resend.com).
2. Verifikasi domain pengirim kamu (atau pakai domain uji Resend untuk testing awal).
3. Buat API Key di dashboard Resend.
4. Isi di `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=RANGKUL <undangan@domainkamu.com>
   ```
5. Restart `npm run dev`. Saat mengundang anggota, email akan otomatis terkirim — status "✓ Email terkirim" atau "mode manual" akan muncul di halaman Anggota Tim tergantung berhasil tidaknya.

Logika ini ada di `app/api/invite/route.ts` — API key sengaja hanya dibaca di server (Route Handler), tidak pernah dikirim ke browser.

---

## 4. Deploy ke Cloudflare Pages

**Penting — Edge Runtime:** Cloudflare Pages menjalankan Next.js lewat Cloudflare Workers, yang mewajibkan setiap route dinamis (halaman yang butuh database/auth, dan semua Route Handler) mendeklarasikan `export const runtime = "edge";`. Starter ini **sudah** menambahkan baris itu di semua route yang perlu (`app/dashboard/*/page.tsx`, `app/auth/callback/route.ts`, `app/api/invite/route.ts`). **Kalau kamu menambah halaman/route baru sendiri di kemudian hari, jangan lupa tambahkan baris ini juga**, atau build Cloudflare akan gagal dengan pesan "routes were not configured to run with the Edge Runtime".

### Langkah A — Push ke GitHub

```bash
# Dari folder project, jalankan sekali:
git init
git add .
git commit -m "Initial commit"
```

Buat repository baru di [github.com/new](https://github.com/new) (jangan centang "Add README"), lalu:

```bash
git remote add origin https://github.com/USERNAME/rangkul-starter.git
git branch -M main
git push -u origin main
```

### Langkah B — Hubungkan ke Cloudflare Pages
1. Di Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pilih repo yang barusan di-push.
3. Framework preset: pilih **Next.js**.
4. Build command: `npx @cloudflare/next-on-pages@1`
   Build output directory: `.vercel/output/static`
5. Di **Environment variables**, tambahkan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan **`SUPABASE_SERVICE_ROLE_KEY`** (nilai sama seperti di `.env.local` — yang terakhir **wajib**, bukan opsional, dipakai `/api/create-organization`). Tambahkan juga `RESEND_API_KEY` dan `RESEND_FROM_EMAIL` kalau sudah pakai fitur email.

   > ⚠️ **Jangan pernah** taruh `SUPABASE_SERVICE_ROLE_KEY` di file `.env.production` (kalau kamu sempat membuat file itu untuk mengatasi masalah build sebelumnya) — file itu ikut ter-commit ke Git, sementara service role key bersifat rahasia (melewati semua RLS). Isi env var ini **hanya** lewat form "Environment variables" di dashboard Cloudflare Pages, bukan lewat file yang di-commit.
6. Klik **Save and Deploy**. Setelah selesai, kamu akan dapat URL gratis seperti `rangkul-starter.pages.dev` — ini sudah bisa dipakai, tidak perlu beli domain.

### Langkah C — Update Supabase & Google OAuth (WAJIB, sering terlewat)
Login lewat Google tidak akan jalan di URL production sampai langkah ini selesai:
1. Di **Google Cloud Console** → Client OAuth yang sudah kamu buat → tambahkan ke **Authorized redirect URIs**: URL Supabase callback-nya sama seperti sebelumnya, tidak berubah (`https://xxxxx.supabase.co/auth/v1/callback`) — jadi biasanya **tidak perlu diubah** di sisi Google.
2. Di **Supabase** → **Authentication > URL Configuration** → tambahkan ke **Redirect URLs**: `https://rangkul-starter.pages.dev/auth/callback` (ganti sesuai domain `.pages.dev` kamu).
3. Coba buka URL production-nya, login dengan Google seperti biasa.

### Via CI/CD (otomatis, opsional — sudah disiapkan)
File `.github/workflows/deploy.yml` sudah dikonfigurasi supaya deploy otomatis tiap `git push`. Tambahkan secrets berikut di **GitHub repo → Settings → Secrets and variables → Actions**:

| Secret | Dari mana |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings > API (wajib, jangan sampai bocor) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard > My Profile > API Tokens (buat token dengan permission "Cloudflare Pages: Edit") |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard, ada di sidebar kanan halaman overview |

Kalau sudah pakai Langkah B (deploy via Dashboard), CI/CD ini opsional — pilih salah satu saja supaya tidak dobel deploy.

---

## 5. Struktur Folder

```
app/
  (auth)/login/       — halaman login
  auth/callback/       — OAuth callback handler
  api/invite/           — Route Handler: buat undangan + kirim email (Resend)
  onboarding/          — wizard pemilihan sektor
  dashboard/
    layout.tsx          — shell (TopBar + Sidebar) + resolusi label sektor
    page.tsx             — Kanban board ("Kelas Saya")
    tasks/page.tsx        — Semua Tugas/PR (filterable)
    chat/page.tsx          — Diskusi (realtime)
    reports/page.tsx        — Rapor Kinerja
    docs/page.tsx             — Dokumen (Supabase Storage)
    team/page.tsx              — Anggota Tim (undang & kelola)
    settings/page.tsx           — Pengaturan (ganti sektor/nama org)
components/
  TopBar.tsx, Sidebar.tsx, Board.tsx, TaskList.tsx, Chat.tsx, DocsManager.tsx,
  NewTaskModal.tsx, TaskDetailModal.tsx, TeamManager.tsx, SettingsForm.tsx
lib/
  labels/sectors.ts    — ⭐ Sector Adaptation Engine (kamus istilah)
  labels/LabelProvider.tsx — React context untuk label dinamis
  data/org.ts            — helper ambil organisasi user saat ini (owner/member/invite)
  data/members.ts          — helper daftar anggota yang bisa di-assign
  data/flat-tasks.ts, sample-tasks.ts — data contoh per sektor (fallback)
  supabase/            — client & server Supabase client
supabase/
  schema.sql            — skema database + RLS (jalankan pertama)
  migrations/002_chat_and_docs.sql — kolom chat + bucket Storage (jalankan kedua)
  migrations/003_team_members.sql   — tabel invitations + auto-join (jalankan ketiga)
  seed.sql               — data awal sector_templates (opsional)
```

## 6. Cara Menambah Sektor Baru

Cukup tambahkan satu entri baru di `lib/labels/sectors.ts` (`SECTOR_LABELS`) dan daftarkan key-nya di `SECTOR_ORDER` — **tidak perlu mengubah komponen UI manapun**, karena semua komponen mengambil teks dari `useLabels()`.

## 7. Roadmap Lanjutan

Ikuti roadmap 4 fase yang sudah dijabarkan di dokumen konsep produk (`Konsep-Produk-RANGKUL.docx`, bab 7):
- **Fase 1 (starter ini)**: MVP 3 sektor prioritas — sudah melampaui target awal (6 sektor + kolaborasi tim)
- **Fase 2**: custom field builder, mobile app, sektor gelombang 2
- **Fase 3**: kalender, laporan lanjutan, integrasi API
- **Fase 4**: sektor niche, multi-bahasa, billing
