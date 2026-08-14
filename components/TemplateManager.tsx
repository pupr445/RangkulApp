"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUserId, useLabels } from "@/lib/labels/LabelProvider";
import { OrganizationTemplate } from "@/lib/data/templates";
import { WorkflowStage } from "@/lib/data/workflows";
import { CustomFieldDef, slugifyFieldKey } from "@/lib/data/custom-fields";
import { logActivity } from "@/lib/data/activity-log";

export function TemplateManager({ organizationId, templates, workflowStages, teams, fields }: {
  organizationId: string;
  templates: OrganizationTemplate[];
  workflowStages: WorkflowStage[];
  teams: { id: string; name: string }[];
  fields: CustomFieldDef[];
}) {
  const labels = useLabels();
  const userId = useCurrentUserId();
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveTemplate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true); setError(null);
    const payload = {
      organization_id: organizationId,
      name: trimmed,
      workflow_stages: workflowStages,
      team_names: teams.map((t) => t.name),
      custom_fields: fields.map((f) => ({
        field_label: f.field_label,
        field_type: f.field_type,
        field_options: f.field_options ?? null,
        is_required: f.is_required ?? false,
        number_min: f.number_min ?? null,
        number_max: f.number_max ?? null,
        date_min: f.date_min ?? null,
        date_max: f.date_max ?? null,
      })),
    };
    const { error: e } = await (supabase as any).from("organization_templates").insert([payload]);
    setSaving(false);
    if (e) { setError(e.message); return; }
    logActivity(supabase, { organizationId, actorId: userId, actorName: "Admin", action: "template.created", targetType: "template", targetId: null, targetLabel: trimmed });
    setName(""); router.refresh();
  }

  async function applyTemplate(t: OrganizationTemplate) {
    if (!confirm(`Terapkan template "${t.name}"? Workflow akan diganti dan tim/field yang belum ada akan ditambahkan.`)) return;
    setSaving(true); setError(null);
    try {
      const client = supabase as any;
      const { error: orgError } = await client.from("organizations").update({ workflow_stages: t.workflow_stages }).eq("id", organizationId);
      if (orgError) throw new Error(orgError.message);
      for (const teamName of t.team_names) {
        if (!teamName.trim()) continue;
        const exists = teams.some((team) => team.name.toLowerCase() === teamName.toLowerCase());
        if (!exists) {
          const { error } = await client.from("teams").insert([{ organization_id: organizationId, name: teamName.trim() }]);
          if (error) throw new Error(error.message);
        }
      }
      for (const f of t.custom_fields) {
        const key = slugifyFieldKey(f.field_label);
        if (!key || fields.some((x) => x.field_key === key)) continue;
        const { error } = await client.from("custom_fields").insert([{
          organization_id: organizationId,
          entity: "task",
          field_key: key,
          field_label: f.field_label,
          field_type: f.field_type,
          field_options: f.field_options ?? null,
          is_required: f.is_required ?? false,
          number_min: f.number_min ?? null,
          number_max: f.number_max ?? null,
          date_min: f.date_min ?? null,
          date_max: f.date_max ?? null,
          sort_order: fields.length,
        }]);
        if (error) throw new Error(error.message);
      }
      logActivity(supabase, { organizationId, actorId: userId, actorName: "Admin", action: "template.applied", targetType: "template", targetId: t.id, targetLabel: t.name });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menerapkan template."); }
    setSaving(false);
  }

  async function removeTemplate(t: OrganizationTemplate) {
    if (!confirm(`Hapus template "${t.name}"?`)) return;
    await (supabase as any).from("organization_templates").delete().eq("id", t.id).eq("organization_id", organizationId);
    router.refresh();
  }

  return <div className="bg-surface border border-border rounded-card p-5 mb-6">
    <h2 className="text-sm font-semibold mb-1">Template Organisasi</h2>
    <p className="text-xs text-inkMuted mb-4">Simpan konfigurasi workflow, tim, dan field saat ini menjadi preset yang dapat diterapkan lagi tanpa mengubah SQL.</p>
    <div className="flex gap-2 mb-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama template, mis. Klinik Gigi" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
      <button onClick={saveTemplate} disabled={!name.trim() || saving} className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: labels.accent }}>{saving ? "Menyimpan…" : "+ Simpan Template"}</button>
    </div>
    {templates.length > 0 && <div className="border border-border rounded-lg overflow-hidden">
      {templates.map((t) => <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-border">
        <div className="flex-1 min-w-0"><div className="text-sm font-semibold">{t.name}</div><div className="text-[11px] text-inkMuted">{t.workflow_stages.length} tahap · {t.team_names.length} tim · {t.custom_fields.length} field</div></div>
        <button onClick={() => applyTemplate(t)} disabled={saving} className="text-xs font-semibold px-3 py-1.5 rounded border border-border">Terapkan</button>
        <button onClick={() => removeTemplate(t)} disabled={saving} className="text-xs font-semibold text-[#8A3E24]">Hapus</button>
      </div>)}
    </div>}
    {error && <p className="text-xs text-[#8A3E24] mt-2">{error}</p>}
  </div>;
}
