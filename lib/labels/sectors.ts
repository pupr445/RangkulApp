/**
 * Sector Adaptation Engine — kamus label
 * ---------------------------------------
 * Ini adalah sumber kebenaran (source of truth) untuk bagaimana istilah
 * generik di seluruh aplikasi (team, task, member, manager, dst.)
 * diterjemahkan menjadi istilah yang relevan per sektor organisasi.
 *
 * Cara kerja:
 * 1. Setiap organisasi punya kolom `sector_type` di tabel `organizations`.
 * 2. Saat render UI, komponen memanggil `getLabels(sectorType, overrides)`.
 * 3. Jika admin organisasi menambahkan `organization_label_overrides` di
 *    database, nilai override tersebut menimpa nilai default di file ini.
 *
 * Menambah sektor baru = menambah satu entri baru di SECTOR_LABELS,
 * tanpa perlu mengubah komponen UI manapun.
 */

export type SectorKey =
  | "sekolah"
  | "klinik"
  | "bisnis"
  | "masjid"
  | "komunitas"
  | "lainnya";

export interface LabelSet {
  sectorDisplayName: string;
  icon: string;
  accent: string;
  accentSoft: string;

  // Peran (roles)
  ownerRole: string; // pemilik/pemimpin tertinggi organisasi
  managerRole: string; // level pengelola tim/menengah
  memberRole: string; // anggota/pengguna akhir

  // Entitas inti
  teamLabel: string; // "Kelas" / "Poli" / "Tim" / "Kepengurusan"
  teamLabelPlural: string;
  projectLabel: string; // "Mata Pelajaran" / "Program" / "Proyek"
  taskLabel: string; // "Tugas/PR" / "Jadwal" / "Tugas"
  taskLabelPlural: string;

  // Navigasi & aksi
  navDashboard: string;
  navTeam: string;
  navTask: string;
  navChat: string;
  navReport: string;
  navDocs: string;
  newTaskCta: string;

  // Papan kerja default
  boardTitleExample: string;
  boardSubtitleExample: string;
}

export const SECTOR_LABELS: Record<SectorKey, LabelSet> = {
  sekolah: {
    sectorDisplayName: "Sekolah",
    icon: "🏫",
    accent: "#3E7CB1",
    accentSoft: "#E7F0F7",
    ownerRole: "Kepala Sekolah",
    managerRole: "Guru",
    memberRole: "Murid",
    teamLabel: "Kelas",
    teamLabelPlural: "Kelas Saya",
    projectLabel: "Mata Pelajaran",
    taskLabel: "Tugas / PR",
    taskLabelPlural: "Semua Tugas / PR",
    navDashboard: "Dashboard",
    navTeam: "Kelas Saya",
    navTask: "Semua Tugas / PR",
    navChat: "Diskusi Kelas",
    navReport: "Rapor Kinerja",
    navDocs: "Dokumen Sekolah",
    newTaskCta: "+ Tugas Baru",
    boardTitleExample: "Papan Kelas 9A",
    boardSubtitleExample: "Progres tugas & PR minggu ini",
  },
  klinik: {
    sectorDisplayName: "Klinik / Kesehatan",
    icon: "🩺",
    accent: "#2F9E7A",
    accentSoft: "#E4F5EF",
    ownerRole: "Dokter Kepala",
    managerRole: "Dokter",
    memberRole: "Pasien",
    teamLabel: "Poli",
    teamLabelPlural: "Poli Saya",
    projectLabel: "Program Layanan",
    taskLabel: "Jadwal",
    taskLabelPlural: "Semua Jadwal",
    navDashboard: "Dashboard",
    navTeam: "Poli Saya",
    navTask: "Semua Jadwal",
    navChat: "Chat Tim Medis",
    navReport: "Laporan Kinerja Staf",
    navDocs: "Dokumen Klinik",
    newTaskCta: "+ Jadwal Baru",
    boardTitleExample: "Papan Poli Umum",
    boardSubtitleExample: "Jadwal & tindak lanjut pasien hari ini",
  },
  bisnis: {
    sectorDisplayName: "Bisnis Umum",
    icon: "💼",
    accent: "#6B4FA0",
    accentSoft: "#EFEAF8",
    ownerRole: "Owner",
    managerRole: "Manager",
    memberRole: "Karyawan",
    teamLabel: "Tim",
    teamLabelPlural: "Tim Saya",
    projectLabel: "Proyek",
    taskLabel: "Tugas",
    taskLabelPlural: "Semua Tugas",
    navDashboard: "Dashboard",
    navTeam: "Tim Saya",
    navTask: "Semua Tugas",
    navChat: "Diskusi Tim",
    navReport: "Laporan Kinerja Tim",
    navDocs: "Dokumen & File",
    newTaskCta: "+ Tugas Baru",
    boardTitleExample: "Papan Proyek: Website Client A",
    boardSubtitleExample: "Progres pekerjaan tim minggu ini",
  },
  masjid: {
    sectorDisplayName: "Masjid / Keagamaan",
    icon: "🕌",
    accent: "#4B6B3F",
    accentSoft: "#EBF1E7",
    ownerRole: "Ketua DKM",
    managerRole: "Pengurus",
    memberRole: "Jamaah",
    teamLabel: "Kepengurusan",
    teamLabelPlural: "Kepengurusan Saya",
    projectLabel: "Program Kegiatan",
    taskLabel: "Kegiatan",
    taskLabelPlural: "Semua Kegiatan",
    navDashboard: "Dashboard",
    navTeam: "Kepengurusan Saya",
    navTask: "Semua Kegiatan",
    navChat: "Diskusi Pengurus",
    navReport: "Laporan Kegiatan",
    navDocs: "Dokumen Masjid",
    newTaskCta: "+ Kegiatan Baru",
    boardTitleExample: "Papan Kepengurusan",
    boardSubtitleExample: "Kegiatan & program masjid bulan ini",
  },
  komunitas: {
    sectorDisplayName: "Komunitas / Organisasi",
    icon: "🤝",
    accent: "#B8862F",
    accentSoft: "#FBF2E1",
    ownerRole: "Ketua",
    managerRole: "Koordinator",
    memberRole: "Anggota",
    teamLabel: "Divisi",
    teamLabelPlural: "Divisi Saya",
    projectLabel: "Program Kerja",
    taskLabel: "Kegiatan",
    taskLabelPlural: "Semua Kegiatan",
    navDashboard: "Dashboard",
    navTeam: "Divisi Saya",
    navTask: "Semua Kegiatan",
    navChat: "Diskusi Anggota",
    navReport: "Laporan Kegiatan",
    navDocs: "Dokumen Komunitas",
    newTaskCta: "+ Kegiatan Baru",
    boardTitleExample: "Papan Divisi Acara",
    boardSubtitleExample: "Persiapan program bulan ini",
  },
  lainnya: {
    sectorDisplayName: "Lainnya (Kustom)",
    icon: "⚙️",
    accent: "#5C7079",
    accentSoft: "#EEF2F3",
    ownerRole: "Pemilik",
    managerRole: "Pengelola",
    memberRole: "Anggota",
    teamLabel: "Tim",
    teamLabelPlural: "Tim Saya",
    projectLabel: "Proyek",
    taskLabel: "Tugas",
    taskLabelPlural: "Semua Tugas",
    navDashboard: "Dashboard",
    navTeam: "Tim Saya",
    navTask: "Semua Tugas",
    navChat: "Diskusi",
    navReport: "Laporan Kinerja",
    navDocs: "Dokumen & File",
    newTaskCta: "+ Tugas Baru",
    boardTitleExample: "Papan Kerja",
    boardSubtitleExample: "Progres pekerjaan tim",
  },
};

export const SECTOR_ORDER: SectorKey[] = [
  "sekolah",
  "klinik",
  "bisnis",
  "masjid",
  "komunitas",
  "lainnya",
];

/**
 * Terapkan override manual milik organisasi (jika ada) ke atas label
 * default sektor. `overrides` biasanya berasal dari tabel
 * `organization_label_overrides` di Supabase — lihat supabase/schema.sql.
 */
export function getLabels(
  sector: SectorKey,
  overrides?: Partial<LabelSet> | null
): LabelSet {
  const base = SECTOR_LABELS[sector] ?? SECTOR_LABELS.lainnya;
  if (!overrides) return base;
  return { ...base, ...overrides };
}
