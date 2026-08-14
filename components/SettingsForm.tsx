"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SECTOR_LABELS, SECTOR_ORDER, SectorKey } from "@/lib/labels/sectors";

export function SettingsForm({
  organizationId,
  currentName,
  currentSector,
}: {
  organizationId: string;
  currentName: string;
  currentSector: SectorKey;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(currentName);
  const [sector, setSector] = useState<SectorKey>(currentSector);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await supabase
      .from("organizations")
      .update({ name: name.trim(), sector_type: sector })
      .eq("id", organizationId);

    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Pengaturan Organisasi</h1>
      <p className="text-sm text-inkMuted mb-8">
        Ganti sektor kapan pun — seluruh istilah &amp; tampilan di aplikasi otomatis menyesuaikan.
        Berguna juga untuk mencoba tampilan sektor lain tanpa perlu akun baru.
      </p>

      <div className="bg-surface border border-border rounded-card p-5 mb-6">
        <label className="block text-sm font-semibold mb-2">Nama Organisasi</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>

      <div className="bg-surface border border-border rounded-card p-5 mb-6">
        <label className="block text-sm font-semibold mb-3">Sektor</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SECTOR_ORDER.map((key) => {
            const s = SECTOR_LABELS[key];
            const active = sector === key;
            return (
              <button
                key={key}
                onClick={() => setSector(key)}
                className="text-left p-3.5 rounded-lg border transition"
                style={
                  active
                    ? { backgroundColor: s.accentSoft, borderColor: s.accent }
                    : { borderColor: "#DEE5E7" }
                }
              >
                <div className="text-xl mb-1.5">{s.icon}</div>
                <div className="font-semibold text-sm">{s.sectorDisplayName}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-ink text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
        >
          {saving ? "Menyimpan…" : "Simpan Perubahan"}
        </button>
        {saved && <span className="text-sm text-[#2F9E7A] font-medium">✓ Tersimpan</span>}
      </div>
    </div>
  );
}
