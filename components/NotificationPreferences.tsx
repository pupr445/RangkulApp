"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationType } from "@/lib/data/notifications";

const TOGGLE_ITEMS: { type: NotificationType; label: string; hint: string }[] = [
  { type: "assignment", label: "Penugasan tugas", hint: "Saat kamu di-assign ke sebuah tugas." },
  { type: "mention", label: "Disebut (mention)", hint: "Saat seseorang menyebut @kamu di chat tim." },
  { type: "dm", label: "Pesan langsung", hint: "Saat menerima pesan langsung dari rekan kerja." },
  { type: "status_changed", label: "Perubahan status", hint: "Saat status tugas yang kamu pegang berubah." },
  { type: "deadline", label: "Pengingat deadline", hint: "H-1 dan hari-H tugas yang kamu pegang." },
  { type: "overdue", label: "Tugas terlambat", hint: "Pengingat berkala untuk tugas yang lewat tenggat." },
  { type: "invitation", label: "Undangan diterima", hint: "Saat orang yang kamu undang bergabung." },
  { type: "summary", label: "Ringkasan harian/mingguan", hint: "Snapshot progres organisasi (untuk Owner & Manager)." },
];

export function NotificationPreferences({
  initialPrefs,
}: {
  initialPrefs: Record<string, boolean>;
}) {
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(type: NotificationType) {
    const next = { ...prefs, [type]: !prefs[type] };
    setPrefs(next);
    setSaving(true);
    setSaved(false);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Sesi tidak ditemukan, coba muat ulang halaman.");
      return;
    }

    // Upsert aman di sini karena tabel ini murni milik user sendiri
    // (RLS: user_id = auth.uid()), tidak ada field role/keanggotaan
    // yang berisiko tertimpa seperti di organization_members.
    const { error: upsertError } = await supabase
      .from("notification_email_prefs")
      .upsert([{ user_id: user.id, prefs: next, updated_at: new Date().toISOString() }], { onConflict: "user_id" });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      setPrefs(prefs); // rollback tampilan kalau gagal disimpan
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Preferensi Notifikasi</h1>
      <p className="text-sm text-inkMuted mb-8">
        Notifikasi dalam aplikasi (lonceng &amp; Pusat Notifikasi) selalu aktif. Atur di sini jenis
        notifikasi mana yang juga ingin kamu terima lewat email.
      </p>

      <div className="bg-surface border border-border rounded-card divide-y divide-border">
        {TOGGLE_ITEMS.map((item) => {
          const active = Boolean(prefs[item.type]);
          return (
            <div key={item.type} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-xs text-inkMuted mt-0.5">{item.hint}</div>
              </div>
              <button
                role="switch"
                aria-checked={active}
                aria-label={`Email untuk ${item.label}`}
                onClick={() => toggle(item.type)}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: active ? "#1F6F5C" : "#D8DEDC" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: active ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-inkMuted h-4">
        {saving && "Menyimpan…"}
        {saved && <span className="text-[#2F9E7A] font-medium">✓ Tersimpan</span>}
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </div>
  );
}
