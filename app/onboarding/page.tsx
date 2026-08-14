"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SECTOR_LABELS, SECTOR_ORDER, SectorKey } from "@/lib/labels/sectors";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const [selected, setSelected] = useState<SectorKey | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [previewTeams, setPreviewTeams] = useState<string[]>([]);
  const [previewFields, setPreviewFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Lapis pengaman kedua (selain middleware): kalau ternyata tidak ada
  // sesi login sama sekali, jangan tampilkan form — alihkan ke /login.
  // Kalau user sudah punya organisasi (mis. buka /onboarding lagi
  // secara tidak sengaja), langsung alihkan ke dashboard — mencegah
  // satu akun membuat organisasi ganda (lihat migration 007).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (existing) {
        router.replace("/dashboard");
      } else {
        setCheckingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pratinjau: kalau sektor yang dipilih punya template siap pakai,
  // tunjukkan tim apa saja yang akan otomatis dibuat.
  useEffect(() => {
    if (!selected) {
      setPreviewTeams([]);
      setPreviewFields([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("sector_templates")
      .select("default_structure")
      .eq("sector_type", selected)
      .limit(1)
      .maybeSingle()
      .then(
        ({
          data,
        }: {
          data: {
            default_structure?: {
              teams?: string[];
              custom_fields?: Array<{ field_label: string }>;
            };
          } | null;
        }) => {
          if (cancelled) return;
          setPreviewTeams(data?.default_structure?.teams ?? []);
          setPreviewFields((data?.default_structure?.custom_fields ?? []).map((f) => f.field_label));
        }
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function handleCreateOrganization() {
    if (!selected || !orgName.trim()) return;
    setLoading(true);
    setError(null);

    // Dibuat lewat API route server-side (bukan insert langsung dari
    // browser) — lihat app/api/create-organization/route.ts untuk alasannya.
    const res = await fetch("/api/create-organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName.trim(), sectorType: selected }),
    });
    const body = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(body?.error ?? "Gagal membuat organisasi. Coba lagi.");
      return;
    }

    if (body?.warning) {
      // Organisasi berhasil dibuat, tapi sebagian template otomatis gagal
      // diterapkan (mis. migrasi database belum lengkap) — tampilkan dulu
      // ke admin, jangan langsung redirect diam-diam.
      setSetupWarning(body.warning as string);
      return;
    }

    router.push("/dashboard");
  }

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-inkMuted">Memeriksa akun kamu…</p>
      </div>
    );
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

          {previewTeams.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold mb-2">
                Otomatis dibuatkan {SECTOR_LABELS[selected].teamLabelPlural.toLowerCase()}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {previewTeams.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: SECTOR_LABELS[selected].accentSoft, color: SECTOR_LABELS[selected].accent }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              {previewFields.length > 0 && (
                <>
                  <p className="text-xs font-semibold mb-2 mt-3">
                    Field data siap pakai untuk {SECTOR_LABELS[selected].taskLabel.toLowerCase()}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewFields.map((f) => (
                      <span
                        key={f}
                        className="text-xs px-2.5 py-1 rounded-full border border-border text-inkMuted"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <p className="text-[11px] text-inkMuted mt-2">
                Bisa diubah atau ditambah kapan pun dari Pengaturan setelah ini.
              </p>
            </div>
          )}
        </div>
      )}

      {setupWarning && (
        <div className="mb-4 bg-[#FBF0E6] border border-[#E8C9A8] rounded-lg p-4">
          <p className="text-sm font-semibold mb-1">Organisasi berhasil dibuat, tapi ada catatan</p>
          <p className="text-sm text-inkMuted mb-3">{setupWarning}</p>
          <p className="text-xs text-inkMuted mb-3">
            Tidak masalah — kamu tetap bisa lanjut pakai RANGKUL. Tim & field tambahan bisa dibuat manual kapan saja
            dari halaman Pengaturan.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Lanjut ke Dashboard
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-[#8A3E24] mb-3">{error}</p>
      )}

      <button
        disabled={!selected || !orgName.trim() || loading || !!setupWarning}
        onClick={handleCreateOrganization}
        className="bg-ink text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
      >
        {loading ? "Menyiapkan ruang kerja…" : "Buat Organisasi"}
      </button>
    </div>
  );
}
