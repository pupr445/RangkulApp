"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTOR_LABELS, SECTOR_ORDER, SectorKey } from "@/lib/labels/sectors";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const [selected, setSelected] = useState<SectorKey | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreateOrganization() {
    if (!selected || !orgName.trim()) return;
    setLoading(true);

    // Membuat organisasi baru. `sector_type` inilah yang nantinya
    // dipakai getLabels() untuk menentukan seluruh istilah di aplikasi.
    // Struktur tim/proyek awal (sector_templates) idealnya dibuat oleh
    // sebuah Postgres function / Edge Function yang dipicu setelah insert ini.
    const { data: userRes } = await supabase.auth.getUser();
    const ownerId = userRes.user?.id;

    // Catatan: cast eksplisit di bawah ini hanya diperlukan sementara,
    // sampai kamu menjalankan `supabase gen types` (lihat README) yang
    // akan memberi tipe Insert yang presisi untuk tabel `organizations`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("organizations").insert([
      {
        name: orgName.trim(),
        sector_type: selected,
        owner_id: ownerId,
      },
    ] as any);

    setLoading(false);
    if (!error) {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-2xl font-display font-bold mb-1">
        Organisasi kamu bergerak di sektor apa?
      </h1>
      <p className="text-sm text-inkMuted mb-8">
        Pilihan ini menentukan istilah, struktur tim, dan tampilan default
        yang akan kamu lihat — bisa disesuaikan lagi kapan pun dari
        Pengaturan.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {SECTOR_ORDER.map((key) => {
          const s = SECTOR_LABELS[key];
          const active = selected === key;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`text-left p-4 rounded-card border transition ${
                active
                  ? "border-transparent shadow-card"
                  : "border-border bg-surface hover:bg-surfaceAlt"
              }`}
              style={active ? { backgroundColor: s.accentSoft, borderColor: s.accent } : undefined}
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="font-semibold text-sm">{s.sectorDisplayName}</div>
              <div className="text-xs text-inkMuted mt-1">
                {s.ownerRole} · {s.managerRole} · {s.memberRole}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="bg-surface border border-border rounded-card p-5 mb-6">
          <label className="block text-sm font-semibold mb-2">
            Nama organisasi
          </label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder={
              selected === "sekolah"
                ? "Contoh: SMA Harapan Bangsa"
                : selected === "klinik"
                ? "Contoh: Klinik Sehat Sentosa"
                : "Nama organisasi kamu"
            }
            className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </div>
      )}

      <button
        disabled={!selected || !orgName.trim() || loading}
        onClick={handleCreateOrganization}
        className="bg-ink text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
      >
        {loading ? "Menyiapkan ruang kerja…" : "Buat Organisasi"}
      </button>
    </div>
  );
}
