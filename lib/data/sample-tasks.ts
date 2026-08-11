import { SectorKey } from "@/lib/labels/sectors";

export interface TaskCard {
  id: string;
  tag: string;
  title: string;
  assignee: string;
  assigneeInitials: string;
  assigneeId?: string;
  teamId?: string;
  due: string;
  customData?: Record<string, string>;
}

export interface BoardColumn {
  id: string;
  name: string;
  cards: TaskCard[];
}

/**
 * Data contoh yang ditampilkan saat organisasi baru belum punya tugas
 * sungguhan — supaya dashboard tidak terlihat kosong/rusak saat demo
 * atau baru saja onboarding. Ganti dengan query ke tabel `tasks` begitu
 * data asli tersedia (lihat app/dashboard/page.tsx).
 */
export function sampleColumnsFor(sector: SectorKey): BoardColumn[] {
  switch (sector) {
    case "sekolah":
      return [
        {
          id: "todo",
          name: "Belum Dikerjakan",
          cards: [
            { id: "1", tag: "Matematika", title: "Kumpulkan Tugas Bab 3 - Persamaan Linear", assignee: "Ahmad R.", assigneeInitials: "AR", due: "Besok" },
            { id: "2", tag: "IPA", title: "Latihan Soal Fotosintesis", assignee: "Kelas 9A", assigneeInitials: "9A", due: "3 hari lagi" },
          ],
        },
        {
          id: "doing",
          name: "Sedang Dikerjakan",
          cards: [{ id: "3", tag: "Sejarah", title: "Presentasi Kelompok - Kemerdekaan RI", assignee: "Kel. 2", assigneeInitials: "K2", due: "5 hari lagi" }],
        },
        {
          id: "done",
          name: "Selesai",
          cards: [{ id: "4", tag: "B. Indonesia", title: "Ulangan Harian - Teks Deskripsi", assignee: "Kelas 9A", assigneeInitials: "9A", due: "Selesai" }],
        },
      ];
    case "klinik":
      return [
        {
          id: "todo",
          name: "Belum Dikerjakan",
          cards: [
            { id: "1", tag: "Kontrol", title: "Follow-up Pasien Budi S. - Diabetes", assignee: "dr. Sari", assigneeInitials: "DS", due: "Hari ini" },
            { id: "2", tag: "Stok", title: "Restock Obat Amoxicillin", assignee: "Apotek", assigneeInitials: "AP", due: "2 hari lagi" },
          ],
        },
        {
          id: "doing",
          name: "Sedang Dikerjakan",
          cards: [{ id: "3", tag: "Lab", title: "Pemeriksaan Lab Pasien Sari W.", assignee: "Lab Klinik", assigneeInitials: "LK", due: "Hari ini" }],
        },
        {
          id: "done",
          name: "Selesai",
          cards: [{ id: "4", tag: "Vaksin", title: "Vaksinasi Rutin Bayi - 12 Peserta", assignee: "dr. Rina", assigneeInitials: "DR", due: "Selesai" }],
        },
      ];
    case "masjid":
      return [
        {
          id: "todo",
          name: "Belum Dikerjakan",
          cards: [
            { id: "1", tag: "Kajian", title: "Persiapan Kajian Jumat", assignee: "Ust. Farhan", assigneeInitials: "UF", due: "3 hari lagi" },
            { id: "2", tag: "Fasilitas", title: "Renovasi Tempat Wudhu", assignee: "Pengurus", assigneeInitials: "PG", due: "2 minggu lagi" },
          ],
        },
        {
          id: "doing",
          name: "Sedang Dikerjakan",
          cards: [{ id: "3", tag: "Donasi", title: "Pengumpulan Donasi Renovasi", assignee: "Bendahara", assigneeInitials: "BD", due: "Berjalan" }],
        },
        {
          id: "done",
          name: "Selesai",
          cards: [{ id: "4", tag: "Zakat", title: "Pembagian Zakat Fitrah", assignee: "Panitia", assigneeInitials: "PN", due: "Selesai" }],
        },
      ];
    case "komunitas":
      return [
        {
          id: "todo",
          name: "Belum Dikerjakan",
          cards: [{ id: "1", tag: "Acara", title: "Booking Venue Gathering Tahunan", assignee: "Divisi Acara", assigneeInitials: "DA", due: "1 minggu lagi" }],
        },
        {
          id: "doing",
          name: "Sedang Dikerjakan",
          cards: [{ id: "2", tag: "Sponsor", title: "Follow-up Proposal Sponsor", assignee: "Koordinator", assigneeInitials: "KO", due: "3 hari lagi" }],
        },
        { id: "done", name: "Selesai", cards: [] },
      ];
    case "bisnis":
    default:
      return [
        {
          id: "todo",
          name: "Belum Dikerjakan",
          cards: [
            { id: "1", tag: "Desain", title: "Revisi Desain Landing Page", assignee: "Rian", assigneeInitials: "RN", due: "Besok" },
            { id: "2", tag: "Finance", title: "Follow up Invoice ke Vendor B", assignee: "Dinda", assigneeInitials: "DN", due: "3 hari lagi" },
          ],
        },
        {
          id: "doing",
          name: "Sedang Dikerjakan",
          cards: [{ id: "3", tag: "Dev", title: "Development Fitur Checkout", assignee: "Bayu", assigneeInitials: "BY", due: "5 hari lagi" }],
        },
        {
          id: "done",
          name: "Selesai",
          cards: [{ id: "4", tag: "Marketing", title: "Laporan Bulanan Marketing", assignee: "Nadia", assigneeInitials: "ND", due: "Selesai" }],
        },
      ];
  }
}
