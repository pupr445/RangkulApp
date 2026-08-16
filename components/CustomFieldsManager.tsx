"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { CustomFieldDef, CustomFieldType, Role, slugifyFieldKey } from "@/lib/data/custom-fields";
import { logActivity } from "@/lib/data/activity-log";

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Teks", number: "Angka", date: "Tanggal", select: "Pilihan (Dropdown)",
};
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", manager: "Manager", member: "Member" };
const ALL_ROLES: Role[] = ["owner", "manager", "member"];

type Draft = {
  label: string; type: CustomFieldType; optionsText: string; required: boolean;
  numberMin: string; numberMax: string; dateMin: string; dateMax: string;
  dependsOnFieldKey: string; dependsOnValue: string;
  visibleTo: Role[]; editableBy: Role[];
};
const EMPTY: Draft = {
  label: "", type: "text", optionsText: "", required: false, numberMin: "", numberMax: "", dateMin: "", dateMax: "",
  dependsOnFieldKey: "", dependsOnValue: "", visibleTo: ALL_ROLES, editableBy: ALL_ROLES,
};

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
      dependsOnFieldKey: field.depends_on_field_key ?? "",
      dependsOnValue: field.depends_on_value ?? "",
      visibleTo: field.visible_to ?? ALL_ROLES,
      editableBy: field.editable_by ?? ALL_ROLES,
    });
    setError(null);
  }

  function reset() { setEditingId(null); setDraft(EMPTY); setError(null); }

  function toggleRole(list: "visibleTo" | "editableBy", role: Role) {
    setDraft((prev) => {
      const has = prev[list].includes(role);
      const nextList = has ? prev[list].filter((r) => r !== role) : [...prev[list], role];
      // editableBy tidak boleh punya role yang tidak ada di visibleTo —
      // tidak masuk akal bisa mengisi field yang tidak terlihat.
      const nextEditable = list === "visibleTo" && has ? prev.editableBy.filter((r) => r !== role) : prev.editableBy;
      return { ...prev, [list]: nextList, editableBy: list === "visibleTo" ? nextEditable : prev.editableBy };
    });
  }

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
    if (draft.dependsOnFieldKey && !draft.dependsOnValue.trim()) throw new Error("Isi nilai syarat untuk field bersyarat, atau kosongkan field acuannya.");
    if (draft.visibleTo.length === 0) throw new Error("Minimal satu role harus bisa melihat field ini.");
    return {
      key, trimmed, options, numberMin, numberMax, dateMin, dateMax,
      dependsOnFieldKey: draft.dependsOnFieldKey || null,
      dependsOnValue: draft.dependsOnFieldKey ? draft.dependsOnValue.trim() : null,
      visibleTo: draft.visibleTo,
      editableBy: draft.editableBy,
    };
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const x = parseDraft();
      const payload = {
        field_label: x.trimmed, field_key: x.key, field_type: draft.type, field_options: x.options,
        is_required: draft.required, number_min: x.numberMin, number_max: x.numberMax, date_min: x.dateMin, date_max: x.dateMax,
        depends_on_field_key: x.dependsOnFieldKey, depends_on_value: x.dependsOnValue,
        visible_to: x.visibleTo, editable_by: x.editableBy,
      };
      if (editingId) {
        const { error: e } = await supabase.from("custom_fields").update(payload).eq("id", editingId).eq("organization_id", organizationId);
        if (e) throw new Error(e.message);
      } else {
        const maxOrder = fields.reduce((m, f) => Math.max(m, f.sort_order ?? 0), -1);
        const { error: e } = await supabase.from("custom_fields").insert([{ ...payload, organization_id: organizationId, entity: "task", sort_order: maxOrder + 1 }]);
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
    await Promise.all([
      supabase.from("custom_fields").update({ sort_order: b.sort_order ?? next }).eq("id", a.id),
      supabase.from("custom_fields").update({ sort_order: a.sort_order ?? index }).eq("id", b.id),
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
          {f.depends_on_field_key && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surfaceAlt text-inkMuted">Bersyarat</span>}
          {(f.visible_to?.length ?? 3) < 3 && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surfaceAlt text-inkMuted">Terbatas: {(f.visible_to ?? []).map((r) => ROLE_LABEL[r]).join(", ")}</span>}
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

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold mb-1.5">Field bersyarat (opsional)</p>
        <p className="text-[11px] text-inkMuted mb-2">Field ini hanya muncul kalau field lain bernilai tertentu — mis. "Jenis Tindakan" cuma tampil kalau "Kategori" = "Medis".</p>
        <div className="grid md:grid-cols-2 gap-2">
          <select
            value={draft.dependsOnFieldKey}
            onChange={(e) => setDraft({ ...draft, dependsOnFieldKey: e.target.value })}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
          >
            <option value="">Selalu tampil (tanpa syarat)</option>
            {fields.filter((f) => f.id !== editingId).map((f) => (
              <option key={f.field_key} value={f.field_key}>Kalau "{f.field_label}" =</option>
            ))}
          </select>
          {draft.dependsOnFieldKey && (
            <input
              value={draft.dependsOnValue}
              onChange={(e) => setDraft({ ...draft, dependsOnValue: e.target.value })}
              placeholder="Nilai syaratnya, mis. Medis"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
            />
          )}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold mb-1.5">Siapa boleh lihat &amp; isi field ini</p>
        <div className="flex flex-wrap gap-3">
          {ALL_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-3 text-xs">
              <span className="text-inkMuted w-14">{ROLE_LABEL[role]}</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={draft.visibleTo.includes(role)} onChange={() => toggleRole("visibleTo", role)} /> Lihat
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.editableBy.includes(role)}
                  disabled={!draft.visibleTo.includes(role)}
                  onChange={() => toggleRole("editableBy", role)}
                /> Isi
              </label>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-[#8A3E24]">{error}</p>}
      <div className="flex gap-2 justify-end"><button onClick={save} disabled={saving || !draft.label.trim()} className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: labels.accent }}>{saving ? "Menyimpan…" : editingId ? "Simpan Perubahan" : "+ Tambah Field"}</button>{editingId && <button onClick={reset} disabled={saving} className="text-sm px-4 py-2">Batal</button>}</div>
    </div>
  </div>;
}
