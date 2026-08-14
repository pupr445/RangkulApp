"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { logActivity, logSecurityAudit } from "@/lib/data/activity-log";
import { WorkflowStage } from "@/lib/data/workflows";

const COLOR_OPTIONS = [
  { value: "#64748B", name: "Abu-abu" },
  { value: "#2563EB", name: "Biru" },
  { value: "#0EA5E9", name: "Biru Langit" },
  { value: "#7C3AED", name: "Ungu" },
  { value: "#DB2777", name: "Merah Muda" },
  { value: "#DC2626", name: "Merah" },
  { value: "#D97706", name: "Oranye" },
  { value: "#16A34A", name: "Hijau" },
  { value: "#0F766E", name: "Teal" },
  { value: "#92400E", name: "Cokelat" },
];

function keyFromLabel(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
}

function sanitizeStages(stages: WorkflowStage[]) {
  const keys = new Set(stages.map((s) => s.key));
  let initialAssigned = false;
  const next = stages.map((s, i) => {
    const initial = !initialAssigned && (s.initial || i === 0);
    if (initial) initialAssigned = true;
    const transitions = s.final ? [] : (s.transitions ?? []).filter((key) => keys.has(key) && key !== s.key);
    return { ...s, initial, final: Boolean(s.final), transitions };
  });
  if (!next.some((s) => s.final)) next[next.length - 1].final = true;
  next.forEach((s) => {
    if (s.final) s.transitions = [];
    if (!s.final && !s.transitions.length) {
      const index = next.findIndex((x) => x.key === s.key);
      const fallback = next[index + 1];
      if (fallback) s.transitions = [fallback.key];
    }
  });
  return next;
}

export function WorkflowManager({ organizationId, stages }: { organizationId: string; stages: WorkflowStage[] }) {
  const labels = useLabels();
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<WorkflowStage[]>(stages);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openColorIndex, setOpenColorIndex] = useState<number | null>(null);

  const canSave = useMemo(() => items.length >= 2 && items.every((x) => x.key && x.label), [items]);

  function markDirty() {
    setSaved(false);
    setError(null);
  }

  function updateItem(index: number, patch: Partial<WorkflowStage>) {
    markDirty();
    setItems((prev) => sanitizeStages(prev.map((x, i) => (i === index ? { ...x, ...patch } : x))));
  }

  function addStage() {
    const nextLabel = label.trim();
    if (!nextLabel) return;
    const key = keyFromLabel(nextLabel);
    if (!key) return;
    if (items.some((x) => x.key === key)) {
      setError("Tahap dengan nama serupa sudah ada.");
      return;
    }
    markDirty();
    setItems((prev) => {
      const updated = [...prev, { key, label: nextLabel, color: "#2563EB", initial: false, final: true, transitions: [] }];
      const beforeLast = updated[updated.length - 2];
      if (beforeLast) beforeLast.transitions = [key];
      beforeLast.final = false;
      return sanitizeStages(updated);
    });
    setLabel("");
    setError(null);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    markDirty();
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return sanitizeStages(next);
    });
  }

  function remove(index: number) {
    if (items.length <= 2) {
      setError("Workflow minimal memiliki 2 tahap.");
      return;
    }
    markDirty();
    setItems((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      const fallbackTarget = next[Math.min(index, next.length - 1)];
      return sanitizeStages(next.map((s) => ({
        ...s,
        transitions: (s.transitions ?? []).filter((key) => key !== removed.key).length
          ? (s.transitions ?? []).filter((key) => key !== removed.key)
          : (fallbackTarget && s.key !== fallbackTarget.key && !s.final ? [fallbackTarget.key] : s.transitions),
      })));
    });
  }

  function toggleInitial(index: number) {
    markDirty();
    setItems((prev) => prev.map((s, i) => ({ ...s, initial: i === index })).map((s) => ({
      ...s,
      transitions: s.final ? [] : s.transitions,
    })));
  }

  function toggleFinal(index: number) {
    if (items.filter((s) => s.final).length === 1 && items[index].final) {
      setError("Minimal satu tahap harus menjadi tahap akhir.");
      return;
    }
    markDirty();
    setItems((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      return { ...s, final: !s.final, transitions: !s.final ? [] : s.transitions };
    }));
    setError(null);
  }

  function toggleTransition(fromIndex: number, toKey: string) {
    if (fromIndex === items.findIndex((s) => s.key === toKey)) return;
    markDirty();
    setItems((prev) => prev.map((s, i) => {
      if (i !== fromIndex) return s;
      const current = s.transitions ?? [];
      const transitions = current.includes(toKey) ? current.filter((x) => x !== toKey) : [...current, toKey];
      return { ...s, transitions, final: transitions.length === 0 ? false : s.final };
    }).map((s) => s.final ? { ...s, transitions: [] } : s));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const payload = sanitizeStages(items);
    const { error: updateError } = await (supabase as any)
      .from("organizations")
      .update({ workflow_stages: payload })
      .eq("id", organizationId);
    setSaving(false);
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }
    setSaved(true);
    logActivity(supabase, {
      organizationId,
      actorId: currentUserId,
      actorName: "Admin",
      action: "workflow.updated",
      targetType: "organization",
      targetId: organizationId,
      targetLabel: labels.sectorDisplayName,
      detail: `${payload.length} tahap; initial=${payload.find((s) => s.initial)?.label ?? "-"}; final=${payload.filter((s) => s.final).map((s) => s.label).join(", ")}`,
    });
    logSecurityAudit(supabase, {
      organizationId,
      actorId: currentUserId,
      actorName: "Admin",
      action: "workflow.updated",
      targetType: "organization",
      targetId: organizationId,
      targetLabel: labels.sectorDisplayName,
      detail: `${payload.length} tahap; initial=${payload.find((s) => s.initial)?.label ?? "-"}; final=${payload.filter((s) => s.final).map((s) => s.label).join(", ")}`,
    });
    router.refresh();
  }

  return (
    <div className="bg-surface border border-border rounded-card p-5 mb-6">
      <h2 className="text-sm font-semibold mb-1">Workflow {labels.taskLabel}</h2>
      <p className="text-xs text-inkMuted mb-4">Bangun alur kerja sektor: nama, warna, tahap awal/akhir, dan status yang boleh dituju.</p>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.key} className="border border-border rounded-lg p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-7 shrink-0 text-center text-xs font-bold text-inkMuted">{index + 1}</div>
              <div className="min-w-0 flex-1 basis-[220px]">
                <input
                  value={item.label}
                  onChange={(e) => updateItem(index, { label: e.target.value })}
                  className="w-full min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-surface"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  title={`Warna: ${COLOR_OPTIONS.find((c) => c.value.toUpperCase() === (item.color ?? "#2563EB").toUpperCase())?.name ?? "Pilih warna"}`}
                  aria-label={`Pilih warna untuk ${item.label}`}
                  aria-expanded={openColorIndex === index}
                  onClick={() => setOpenColorIndex(openColorIndex === index ? null : index)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface hover:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-offset-1"
                >
                  <span
                    className="h-4.5 w-4.5 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: item.color ?? "#2563EB" }}
                  />
                </button>

                {openColorIndex === index && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-[168px] rounded-xl border border-border bg-surface p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-ink">Warna status</span>
                      <button
                        type="button"
                        onClick={() => setOpenColorIndex(null)}
                        className="text-xs text-inkMuted hover:text-ink"
                        aria-label="Tutup pilihan warna"
                      >
                        ×
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {COLOR_OPTIONS.map((color) => {
                        const selected = (item.color ?? "#2563EB").toUpperCase() === color.value.toUpperCase();
                        return (
                          <button
                            key={color.value}
                            type="button"
                            title={color.name}
                            aria-label={`Warna ${color.name}`}
                            aria-pressed={selected}
                            onClick={() => {
                              updateItem(index, { color: color.value });
                              setOpenColorIndex(null);
                            }}
                            className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
                            style={{
                              backgroundColor: color.value,
                              boxShadow: selected ? `0 0 0 2px var(--surface), 0 0 0 4px ${color.value}` : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[10px] text-inkMuted">
                      {COLOR_OPTIONS.find((c) => c.value.toUpperCase() === (item.color ?? "#2563EB").toUpperCase())?.name ?? "Warna"}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => move(index, -1)} disabled={index === 0} className="h-9 w-9 text-xs border border-border rounded-lg disabled:opacity-30" aria-label={`Naikkan ${item.label}`}>↑</button>
                <button onClick={() => move(index, 1)} disabled={index === items.length - 1} className="h-9 w-9 text-xs border border-border rounded-lg disabled:opacity-30" aria-label={`Turunkan ${item.label}`}>↓</button>
                <button onClick={() => remove(index)} className="h-9 px-2 text-xs rounded-lg text-[#8A3E24] hover:bg-[#8A3E24]/5">Hapus</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 ml-7">
              <button onClick={() => toggleInitial(index)} className={`text-[11px] px-2 py-1 rounded-full border ${item.initial ? "font-bold" : ""}`} style={item.initial ? { borderColor: item.color, color: item.color } : undefined}>
                {item.initial ? "✓ " : ""}Tahap awal
              </button>
              <button onClick={() => toggleFinal(index)} className={`text-[11px] px-2 py-1 rounded-full border ${item.final ? "font-bold" : ""}`} style={item.final ? { borderColor: item.color, color: item.color } : undefined}>
                {item.final ? "✓ " : ""}Tahap akhir
              </button>
            </div>

            {!item.final && (
              <div className="mt-3 ml-7">
                <p className="text-[11px] font-semibold text-inkMuted mb-1">Boleh berpindah ke:</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.filter((target) => target.key !== item.key).map((target) => (
                    <button key={target.key} onClick={() => toggleTransition(index, target.key)} className={`text-[11px] px-2 py-1 rounded-full border ${item.transitions?.includes(target.key) ? "font-semibold" : "text-inkMuted"}`} style={item.transitions?.includes(target.key) ? { borderColor: target.color, color: target.color } : undefined}>
                      {item.transitions?.includes(target.key) ? "✓ " : ""}{target.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addStage(); }} placeholder="Tambah tahap, mis. Menunggu Hasil" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
        <button onClick={addStage} className="border border-border rounded-lg px-4 py-2 text-sm font-semibold">+ Tahap</button>
      </div>

      {error && <p className="text-xs text-[#8A3E24] mt-2" role="alert">{error}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {saved && !saving && !error && (
          <span className="text-xs font-semibold text-emerald-700" role="status" aria-live="polite">
            ✓ Workflow tersimpan
          </span>
        )}
        <button
          onClick={save}
          disabled={saving || !canSave}
          className="w-full sm:w-auto text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ backgroundColor: labels.accent }}
        >
          {saving ? "Menyimpan…" : saved ? "Tersimpan" : "Simpan Workflow"}
        </button>
      </div>
    </div>
  );
}
