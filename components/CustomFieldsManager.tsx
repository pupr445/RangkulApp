"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { CustomFieldDef, CustomFieldType, slugifyFieldKey } from "@/lib/data/custom-fields";
import { logActivity } from "@/lib/data/activity-log";

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Teks", number: "Angka", date: "Tanggal", select: "Pilihan (Dropdown)",
};

type Draft = { label: string; type: CustomFieldType; optionsText: string; required: boolean; numberMin: string; numberMax: string; dateMin: string; dateMax: string };
const EMPTY: Draft = { label: "", type: "text", optionsText: "", required: false, numberMin: "", numberMax: "", dateMin: "", dateMax: "" };

export function CustomFieldsManager({ organizationId, fields }: { organizationId: string; fields: CustomFieldDef[] }) {
  const labels = useLabels();
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const supabase = createClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function edit(field: CustomFieldDef) {
    setEditingId(field.id);
    setDraft({
      label: field.field_label,
      type: field.field_type,
      optionsText: (field.field_options ?? []).join(", "),
      required: Boolean(field.is_required),
      numberMin: field.number_min == null ? "" : String(field.number_min),
      numberMax: field.number_max == null ? "" : String(field.number_max),
      dateMin: field.date_min ?? "",
      dateMax: field.date_max ?? "",
    });
    setError(null);
  }

  function reset() { setEditingId(null); setDraft(EMPTY); setError(null); }

  function parseDraft() {
    const trimmed = draft.label.trim();
    if (!trimmed) throw new Error("Nama field wajib diisi.");
    const key = slugifyFieldKey(trimmed);
    if (!key) throw new Error("Nama field tidak valid — coba pakai huruf/angka.");
    const duplicate = fields.some((f) => f.field_key === key && f.id !== editingId);
    if (duplicate) throw new Error("Sudah ada field dengan nama serupa.");
    const options = draft.type === "select" ? draft.optionsText.split(",").map((x) => x.trim()).filter(Boolean) : null;
    if (draft.type === "select" && (!options || options.length < 2)) throw new Error("Field pilihan butuh minimal 2 opsi.");
    const numberMin = draft.type === "number" && draft.numberMin !== "" ? Number(draft.numberMin) : null;
    const numberMax = draft.type === "number" && draft.numberMax !== "" ? Number(draft.numberMax) : null;
    if (numberMin != null && numberMax != null && numberMin > numberMax) throw new Error("Nilai minimum tidak boleh lebih besar dari maksimum.");
    const dateMin = draft.type === "date" && draft.dateMin ? draft.dateMin : null;
    const dateMax = draft.type === "date" && draft.dateMax ? draft.dateMax : null;
    if (dateMin && dateMax && dateMin > dateMax) throw new Error("Tanggal minimum tidak boleh setelah maksimum.");
    return { key, trimmed, options, numberMin, numberMax, dateMin, dateMax };
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const x = parseDraft();
      const client = supabase as any;
      if (editingId) {
        const { error: e } = await client.from("custom_fields").update({ field_label: x.trimmed, field_key: x.key, field_type: draft.type, field_options: x.options, is_required: draft.required, number_min: x.numberMin, number_max: x.numberMax, date_min: x.dateMin, date_max: x.dateMax }).eq("id", editingId).eq("organization_id", organizationId);
        if (e) throw new Error(e.message);
      } else {
        const maxOrder = fields.reduce((m, f) => Math.max(m, f.sort_order ?? 0), -1);
        const { error: e } = await client.from("custom_fields").insert([{ organization_id: organizationId, entity: "task", field_key: x.key, field_label: x.trimmed, field_type: draft.type, field_options: x.options, is_required: draft.required, number_min: x.numberMin, number_max: x.numberMax, date_min: x.dateMin, date_max: x.dateMax, sort_order: maxOrder + 1 }]);
        if (e) throw new Error(e.message);
      }
      const { data: u } = await supabase.auth.getUser();
      logActivity(supabase, { organizationId, actorId: currentUserId, actorName: (u.user?.user_metadata?.full_name as string | undefined) ?? u.user?.email?.split("@")[0] ?? "Seseorang", action: editingId ? "custom_field.updated" : "custom_field.created", targetType: "custom_field", targetId: editingId, targetLabel: x.trimmed });
      reset(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan field."); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus field ini? Nilai lama pada tugas tetap tersimpan tetapi tidak akan tampil lagi.")) return;
    await supabase.from("custom_fields").delete().eq("id", id).eq("organization_id", organizationId);
    router.refresh();
  }

  async function reorder(index: number, direction: -1 | 1) {
    const next = index + direction; if (next < 0 || next >= fields.length) return;
    const a = fields[index], b = fields[next];
    const client = supabase as any;
    await Promise.all([
      client.from("custom_fields").update({ sort_order: b.sort_order ?? next }).eq("id", a.id),
      client.from("custom_fields").update({ sort_order: a.sort_order ?? index }).eq("id", b.id),
    ]);
    router.refresh();
  }

  return <div className="bg-surface border border-border rounded-card p-5 mb-6">
    <h2 className="text-sm font-semibold mb-1">Field Tambahan untuk {labels.taskLabel}</h2>
    <p className="text-xs text-inkMuted mb-4">Sekarang field dapat dibuat, diedit, diurutkan, dan diberi aturan validasi.</p>
    {fields.length > 0 && <div className="border border-border rounded-lg overflow-hidden mb-4">
      {fields.map((f, idx) => <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-border">
        <div className="w-6 text-xs text-inkMuted">{idx + 1}</div>
        <div className="flex-1 min-w-0 text-sm"><span className="font-medium">{f.field_label}</span> <span className="text-xs text-inkMuted">({TYPE_LABEL[f.field_type]})</span>{f.is_required && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: labels.accentSoft, color: labels.accent }}>Wajib</span>}
          {f.field_type === "select" && f.field_options?.length ? <div className="text-[11px] text-inkMuted truncate">{f.field_options.join(" · ")}</div> : null}
        </div>
        <button onClick={() => reorder(idx, -1)} disabled={idx === 0} className="text-xs border border-border rounded px-2 py-1 disabled:opacity-30">↑</button>
        <button onClick={() => reorder(idx, 1)} disabled={idx === fields.length - 1} className="text-xs border border-border rounded px-2 py-1 disabled:opacity-30">↓</button>
        <button onClick={() => edit(f)} className="text-xs font-semibold">Edit</button>
        <button onClick={() => handleDelete(f.id)} className="text-xs font-semibold text-[#8A3E24]">Hapus</button>
      </div>)}
    </div>}

    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-2">
        <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Nama field, mis. Nilai Ujian" className="border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CustomFieldType })} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface">
          {Object.entries(TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {draft.type === "select" && <input value={draft.optionsText} onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })} placeholder="Opsi dipisah koma" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface" />}
      {draft.type === "number" && <div className="grid grid-cols-2 gap-2"><input type="number" value={draft.numberMin} onChange={(e) => setDraft({ ...draft, numberMin: e.target.value })} placeholder="Minimum" className="border border-border rounded-lg px-3 py-2 text-sm bg-surface" /><input type="number" value={draft.numberMax} onChange={(e) => setDraft({ ...draft, numberMax: e.target.value })} placeholder="Maksimum" className="border border-border rounded-lg px-3 py-2 text-sm bg-surface" /></div>}
      {draft.type === "date" && <div className="grid grid-cols-2 gap-2"><input type="date" value={draft.dateMin} onChange={(e) => setDraft({ ...draft, dateMin: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface" /><input type="date" value={draft.dateMax} onChange={(e) => setDraft({ ...draft, dateMax: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface" /></div>}
      <label className="flex items-center gap-2 text-xs text-inkMuted"><input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} /> Wajib diisi</label>
      {error && <p className="text-xs text-[#8A3E24]">{error}</p>}
      <div className="flex gap-2 justify-end"><button onClick={save} disabled={saving || !draft.label.trim()} className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: labels.accent }}>{saving ? "Menyimpan…" : editingId ? "Simpan Perubahan" : "+ Tambah Field"}</button>{editingId && <button onClick={reset} disabled={saving} className="text-sm px-4 py-2">Batal</button>}</div>
    </div>
  </div>;
}
