"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/lib/labels/LabelProvider";
import { LabelSet } from "@/lib/labels/sectors";

// Kurasi field yang paling sering dilihat pengguna sehari-hari — bukan
// semua field di LabelSet (ada ~20+), supaya form ini tidak menakutkan.
const OVERRIDABLE_FIELDS: { key: keyof LabelSet; hint: string }[] = [
  { key: "ownerRole", hint: 'Peran pemilik tertinggi, mis. "Kepala Sekolah"' },
  { key: "managerRole", hint: 'Peran pengelola, mis. "Guru"' },
  { key: "memberRole", hint: 'Peran anggota biasa, mis. "Murid"' },
  { key: "teamLabel", hint: 'Nama satu tim/kelompok, mis. "Kelas"' },
  { key: "teamLabelPlural", hint: "Label menu tim di sidebar" },
  { key: "taskLabel", hint: 'Nama satu tugas, mis. "Tugas/PR"' },
  { key: "taskLabelPlural", hint: "Label menu tugas di sidebar" },
  { key: "navChat", hint: "Label menu diskusi/chat" },
  { key: "navReport", hint: "Label menu laporan kinerja" },
  { key: "navDocs", hint: "Label menu dokumen" },
  { key: "newTaskCta", hint: 'Teks tombol buat tugas, mis. "+ Tugas Baru"' },
];

const FIELD_TITLE: Record<string, string> = {
  ownerRole: "Peran Pemilik",
  managerRole: "Peran Pengelola",
  memberRole: "Peran Anggota",
  teamLabel: "Nama Tim (tunggal)",
  teamLabelPlural: "Menu Tim (sidebar)",
  taskLabel: "Nama Tugas (tunggal)",
  taskLabelPlural: "Menu Tugas (sidebar)",
  navChat: "Menu Diskusi",
  navReport: "Menu Laporan Kinerja",
  navDocs: "Menu Dokumen",
  newTaskCta: "Teks Tombol Buat Tugas",
};

export function LabelOverridesManager({
  organizationId,
  currentOverrides,
}: {
  organizationId: string;
  currentOverrides: Record<string, string> | null;
}) {
  const labels = useLabels(); // sudah termasuk override yang aktif -> jadi default value form
  const router = useRouter();
  const supabase = createClient();

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of OVERRIDABLE_FIELDS) {
      if (currentOverrides?.[f.key]) initial[f.key] = currentOverrides[f.key];
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(key: string, value: string) {
    setValues((prev) => {
      const next = { ...prev };
      if (value.trim()) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ label_overrides: values })
      .eq("id", organizationId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    setValues({});
  }

  return (
    <div className="bg-surface border border-border rounded-card p-5 mb-6">
      <h2 className="text-sm font-semibold mb-1">Sesuaikan Istilah Manual</h2>
      <p className="text-xs text-inkMuted mb-4">
        Template sektor sudah mengisi istilah default secara otomatis. Kalau ada yang ingin diganti sesuai
        kebiasaan organisasi kamu, isi di bawah — kosongkan untuk kembali ke istilah default sektor.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {OVERRIDABLE_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-semibold mb-1">{FIELD_TITLE[f.key]}</label>
            <input
              value={values[f.key] ?? ""}
              onChange={(e) => handleChange(f.key, e.target.value)}
              placeholder={String(labels[f.key] ?? "")}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <p className="text-[11px] text-inkMuted mt-1">{f.hint}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-[#8A3E24] mb-3">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-ink text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
        >
          {saving ? "Menyimpan…" : "Simpan Istilah"}
        </button>
        <button
          onClick={handleReset}
          disabled={saving || Object.keys(values).length === 0}
          className="text-sm font-semibold px-4 py-2 rounded-lg text-inkMuted hover:bg-surfaceAlt disabled:opacity-40 transition"
        >
          Kembalikan Semua ke Default
        </button>
        {saved && <span className="text-sm text-[#2F9E7A] font-medium">✓ Tersimpan</span>}
      </div>
    </div>
  );
}
