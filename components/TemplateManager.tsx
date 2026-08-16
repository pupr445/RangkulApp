"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUserId, useLabels } from "@/lib/labels/LabelProvider";
import { OrganizationTemplate, groupTemplatesByName } from "@/lib/data/templates";
import { WorkflowStage } from "@/lib/data/workflows";
import { CustomFieldDef, slugifyFieldKey } from "@/lib/data/custom-fields";
import { logActivity, logSecurityAudit } from "@/lib/data/activity-log";

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
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const grouped = groupTemplatesByName(templates);

  function toggleHistory(name: string) {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function saveTemplate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true); setError(null);
    // Kalau nama ini sudah pernah dipakai, simpan sebagai VERSI BARU
    // (bukan menimpa) — histori versi lama tetap ada, bisa dilihat/
    // diterapkan lagi lewat "Lihat riwayat versi".
    const existingVersions = templates.filter((t) => t.name === trimmed).map((t) => t.version);
    const nextVersion = existingVersions.length ? Math.max(...existingVersions) + 1 : 1;
    const payload = {
      organization_id: organizationId,
      name: trimmed,
      version: nextVersion,
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
    const { error: e } = await supabase.from("organization_templates").insert([payload]);
    setSaving(false);
    if (e) { setError(e.message); return; }
    const actionLabel = nextVersion > 1 ? `${trimmed} (v${nextVersion})` : trimmed;
    logActivity(supabase, { organizationId, actorId: userId, actorName: "Admin", action: "template.created", targetType: "template", targetId: null, targetLabel: actionLabel });
    logSecurityAudit({ organizationId, actorId: userId, actorName: "Admin", action: "template.created", targetType: "template", targetId: null, targetLabel: actionLabel });
    setName(""); router.refresh();
  }

  /** Duplikat: isi nama input dengan "{nama} (salinan)" dari template yang dipilih — bukan langsung insert, supaya pengguna bisa ganti nama dulu sebelum benar-benar disimpan. */
  function prepareClone(t: OrganizationTemplate) {
    setName(`${t.name} (salinan)`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function applyTemplate(t: OrganizationTemplate) {
    if (!confirm(`Terapkan template "${t.name}" (v${t.version})? Workflow akan diganti dan tim/field yang belum ada akan ditambahkan.`)) return;
    setSaving(true); setError(null);
    try {
      const { error: orgError } = await supabase.from("organizations").update({ workflow_stages: t.workflow_stages }).eq("id", organizationId);
      if (orgError) throw new Error(orgError.message);
      for (const teamName of t.team_names) {
        if (!teamName.trim()) continue;
        const exists = teams.some((team) => team.name.toLowerCase() === teamName.toLowerCase());
        if (!exists) {
          const { error } = await supabase.from("teams").insert([{ organization_id: organizationId, name: teamName.trim() }]);
          if (error) throw new Error(error.message);
        }
      }
      for (const f of t.custom_fields) {
        const key = slugifyFieldKey(f.field_label);
        if (!key || fields.some((x) => x.field_key === key)) continue;
        const { error } = await supabase.from("custom_fields").insert([{
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
      const actionLabel = `${t.name} (v${t.version})`;
      logActivity(supabase, { organizationId, actorId: userId, actorName: "Admin", action: "template.applied", targetType: "template", targetId: t.id, targetLabel: actionLabel });
      logSecurityAudit({ organizationId, actorId: userId, actorName: "Admin", action: "template.applied", targetType: "template", targetId: t.id, targetLabel: actionLabel });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menerapkan template."); }
    setSaving(false);
  }

  async function removeTemplate(t: OrganizationTemplate) {
    if (!confirm(`Hapus template "${t.name}" (v${t.version})?`)) return;
    await supabase.from("organization_templates").delete().eq("id", t.id).eq("organization_id", organizationId);
    router.refresh();
  }

  return <div className="bg-surface border border-border rounded-card p-5 mb-6">
    <h2 className="text-sm font-semibold mb-1">Template Organisasi</h2>
    <p className="text-xs text-inkMuted mb-4">Simpan konfigurasi workflow, tim, dan field saat ini menjadi preset yang dapat diterapkan lagi tanpa mengubah SQL. Menyimpan dengan nama yang sudah ada akan membuat VERSI BARU, bukan menimpa yang lama.</p>
    <div className="flex gap-2 mb-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama template, mis. Klinik Gigi" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
      <button onClick={saveTemplate} disabled={!name.trim() || saving} className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: labels.accent }}>{saving ? "Menyimpan…" : "+ Simpan Template"}</button>
    </div>
    {grouped.length > 0 && <div className="border border-border rounded-lg overflow-hidden">
      {grouped.map(({ latest: t, history }) => <div key={t.name} className="border-b last:border-b-0 border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {t.name} <span className="text-[11px] font-normal text-inkMuted">v{t.version}</span>
            </div>
            <div className="text-[11px] text-inkMuted">{t.workflow_stages.length} tahap · {t.team_names.length} tim · {t.custom_fields.length} field</div>
          </div>
          <button onClick={() => applyTemplate(t)} disabled={saving} className="text-xs font-semibold px-3 py-1.5 rounded border border-border">Terapkan</button>
          <button onClick={() => prepareClone(t)} disabled={saving} className="text-xs font-semibold px-3 py-1.5 rounded border border-border">Duplikat</button>
          <button onClick={() => removeTemplate(t)} disabled={saving} className="text-xs font-semibold text-[#8A3E24]">Hapus</button>
        </div>
        {history.length > 0 && (
          <div className="px-4 pb-3">
            <button onClick={() => toggleHistory(t.name)} className="text-[11px] font-semibold text-inkMuted hover:text-ink">
              {expandedHistory.has(t.name) ? "▾" : "▸"} Riwayat versi ({history.length})
            </button>
            {expandedHistory.has(t.name) && (
              <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-border">
                {history.map((old) => (
                  <div key={old.id} className="flex items-center gap-3 text-xs">
                    <span className="flex-1 text-inkMuted">v{old.version} — {new Date(old.created_at).toLocaleDateString("id-ID")}</span>
                    <button onClick={() => applyTemplate(old)} disabled={saving} className="font-semibold px-2 py-1 rounded border border-border">Terapkan</button>
                    <button onClick={() => removeTemplate(old)} disabled={saving} className="font-semibold text-[#8A3E24]">Hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>)}
    </div>}
    {error && <p className="text-xs text-[#8A3E24] mt-2">{error}</p>}
  </div>;
}
