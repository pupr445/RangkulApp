# RANGKUL — Starter Codebase

Platform manajemen kerja & komunikasi tim yang **tampilannya menyesuaikan otomatis dengan sektor organisasi** (sekolah, klinik, bisnis, masjid, komunitas, dst). Starter ini adalah fondasi MVP — bukan produk jadi — dibangun dengan stack yang sudah kamu pakai: **Next.js + Supabase + Cloudflare + GitHub**.

Lihat juga dokumen konsep produk lengkap (`Konsep-Produk-RANGKUL.docx`) dan wireframe interaktif (`RANGKUL-wireframe.html`) yang dibuat sebelumnya — starter ini adalah implementasi nyata dari konsep di dokumen tersebut.

## Apa yang sudah ada di starter ini

- ✅ **Sector Adaptation Engine** (`lib/labels/sectors.ts`) — mesin inti yang menerjemahkan istilah generik ke istilah per sektor
- ✅ Autentikasi via Supabase (Google OAuth) + middleware proteksi route
- ✅ Wizard onboarding untuk memilih sektor organisasi
- ✅ **Dashboard / Kanban Board** — terhubung ke tabel `tasks`, fallback ke data contoh jika kosong
- ✅ **Semua Tugas/PR** (`/dashboard/tasks`) — daftar tugas lintas tim dengan filter status
- ✅ **Diskusi** (`/dashboard/chat`) — chat real-time sungguhan via Supabase Realtime (bukan simulasi)
- ✅ **Rapor Kinerja** (`/dashboard/reports`) — agregasi status tugas & tingkat penyelesaian
- ✅ **Dokumen** (`/dashboard/docs`) — upload & unduh file sungguhan via Supabase Storage
- ✅ **Edit & hapus tugas**, ubah status lewat drag & drop maupun dropdown cepat
- ✅ **Anggota Tim** (`/dashboard/team`) — undang anggota lewat email, auto-join saat mereka login dengan email yang diundang
- ✅ **Assign tugas ke anggota tertentu** — dropdown "Ditugaskan ke" di form tugas
- ✅ **Email undangan otomatis** (opsional, lewat Resend — lihat bagian 3 di bawah)
- ✅ **Custom Field per Sektor** (`/dashboard/settings`) — admin bisa tambah kolom data sendiri (mis. "Nilai", "Nama Pasien") tanpa perlu ubah kode
- ✅ **Struktur Tim Majemuk** — satu organisasi bisa punya banyak tim/kelas/poli, tugas bisa dikaitkan & difilter per tim
- ✅ Skema database PostgreSQL multi-tenant lengkap dengan Row Level Security (`supabase/schema.sql`)
- ✅ Konfigurasi deploy ke Cloudflare Pages + GitHub Actions CI/CD (sudah diuji berhasil deploy end-to-end)

## Yang BELUM ada (langkah lanjutan)

- ❌ Kalender
- ❌ Kontrol akses berjenjang sungguhan (role tersimpan di database, tapi belum membatasi hak akses)
- ❌ Override manual istilah oleh admin (mesinnya sudah mendukung, UI belum ada)
- ❌ Template preset otomatis per sektor saat onboarding (auto-buat tim)
- ❌ Chat privat & per-tim (baru ada 1 chat umum se-organisasi), mention, read-by
- ❌ Notifikasi push
- ❌ Laporan kinerja per anggota + ekspor
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
7. (Opsional) jalankan `supabase/seed.sql` untuk data contoh struktur sektor.
8. Aktifkan provider **Google** di **Authentication > Providers**, isi Client ID & Secret dari [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
9. Tambahkan Redirect URL di **Authentication > URL Configuration**: `http://localhost:3000/auth/callback` (dan URL production kamu nanti).
10. Salin `Project URL` dan `anon public key` dari **Project Settings > API** ke `.env.local`.
11. (Opsional, setelah skema stabil) generate tipe TypeScript otomatis:
    ```bash
    npx supabase gen types typescript --project-id <PROJECT_ID> > lib/types/database.ts
    ```

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
5. Di **Environment variables**, tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (nilai sama seperti di `.env.local`). Tambahkan juga `RESEND_API_KEY` dan `RESEND_FROM_EMAIL` kalau sudah pakai fitur email.
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
