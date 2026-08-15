"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/data/activity-log";
import { validateCustomFieldValue } from "@/lib/data/custom-fields";
import { notifyUser } from "@/lib/data/notifications";
import { useLabels, useWorkflowStages } from "@/lib/labels/LabelProvider";
import { getInitialWorkflowStage, workflowStageColor } from "@/lib/data/workflows";
import { MemberOption } from "@/lib/data/members";
import { CustomFieldDef } from "@/lib/data/custom-fields";
import { TeamOption } from "@/lib/data/teams";
import { TaskTemplate, addChecklistItem, fetchTaskTemplates, saveTaskTemplate } from "@/lib/data/task-engine";

export function NewTaskModal({
  open,
  onClose,
  organizationId,
  members = [],
  customFields = [],
  teams = [],
  defaultDueDate,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  members?: MemberOption[];
  customFields?: CustomFieldDef[];
  teams?: TeamOption[];
  /** Prefill tanggal tenggat, mis. saat dibuka dari tanggal yang dipilih di Kalender. */
  defaultDueDate?: string;
}) {
  const labels = useLabels();
  const workflowStages = useWorkflowStages();
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<string>(getInitialWorkflowStage(workflowStages)?.key ?? "todo");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [pendingChecklist, setPendingChecklist] = useState<{ label: string }[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  useEffect(() => {
    if (open) fetchTaskTemplates(supabase, organizationId).then(setTemplates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizationId]);

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (!t) return;
    setTitle(t.title);
    setTag(t.tag ?? "");
    setCustomValues(t.custom_data ?? {});
    setPendingChecklist(t.checklist_items ?? []);
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim() || !title.trim()) return;
    setSavingTemplate(true);
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    const { error: saveError } = await saveTaskTemplate(supabase, {
      organizationId,
      name: templateName.trim(),
      title: title.trim(),
      tag,
      checklistItems: pendingChecklist,
      customData: customValues,
      userId: u?.id ?? "",
    });
    setSavingTemplate(false);
    if (!saveError) {
      setTemplateName("");
      setTemplateSaved(true);
      setTemplates(await fetchTaskTemplates(supabase, organizationId));
      setTimeout(() => setTemplateSaved(false), 2000);
    }
  }

  // Setiap modal dibuka, isi tenggat dari defaultDueDate kalau ada (mis.
  // klik tanggal tertentu di Kalender lalu "Tambah Tugas").
  useEffect(() => {
    if (open) setDueDate(defaultDueDate ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDueDate]);

  if (!open) return null;

  function resetAndClose() {
    setTitle("");
    setTag("");
    setDueDate("");
    setStatus(getInitialWorkflowStage(workflowStages)?.key ?? "todo");
    setAssigneeId("");
    setTeamId("");
    setCustomValues({});
    setError(null);
    setSelectedTemplateId("");
    setPendingChecklist([]);
    setTemplateName("");
    onClose();
  }

  async function handleSubmit() {
    if (!title.trim()) return;

    const invalidField = customFields.map((f) => validateCustomFieldValue(f, customValues[f.field_key] ?? "")).find(Boolean);
    if (invalidField) { setError(invalidField); return; }

    setSaving(true);
    setError(null);

    const { data: inserted, error: insertError } = await supabase
      .from("tasks")
      .insert([
        {
          organization_id: organizationId,
          title: title.trim(),
          tag: tag.trim() || "Umum",
          due_date: dueDate || null,
          status,
          assignee_id: assigneeId || null,
          team_id: teamId || null,
          custom_data: customValues,
        },
      ])
      .select("id")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    const newTaskId = (inserted as { id: string } | null)?.id ?? null;

    if (newTaskId && pendingChecklist.length > 0 && u) {
      pendingChecklist.forEach((item, i) => {
        addChecklistItem(supabase, {
          taskId: newTaskId,
          organizationId,
          label: item.label,
          position: i,
          userId: u.id,
        });
      });
    }

    if (u) {
      const actorName = (u.user_metadata?.full_name as string | undefined) ?? u.email?.split("@")[0] ?? "Seseorang";
      logActivity(supabase, {
        organizationId,
        actorId: u.id,
        actorName,
        action: "task.created",
        targetType: "task",
        targetId: (inserted as { id: string } | null)?.id ?? null,
        targetLabel: title.trim(),
        teamId: teamId || null,
      });

      if (assigneeId) {
        notifyUser(supabase, {
          organizationId,
          recipientId: assigneeId,
          actorId: u.id,
          actorName,
          type: "assignment",
          content: `${actorName} memberikan ${labels.taskLabel.toLowerCase()} "${title.trim()}" untukmu.`,
          link: "/dashboard/tasks",
        });
      }
    }

    resetAndClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
      onClick={resetAndClose}
    >
      <div
        className="bg-surface rounded-card shadow-card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1">{labels.newTaskCta.replace("+", "").trim()}</h2>
        <p className="text-xs text-inkMuted mb-5">
          {labels.taskLabel} baru akan langsung tersimpan ke database.
        </p>

        <div className="space-y-4">
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-1.5">Mulai dari template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink bg-surface"
              >
                <option value="">Kosong (tanpa template)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5">Judul</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Contoh: ${labels.taskLabel} baru...`}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Kategori</label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Umum"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Tenggat</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
              />
            </div>
          </div>

          {teams.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-1.5">{labels.teamLabel}</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink bg-surface"
              >
                <option value="">Belum ditentukan</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5">Ditugaskan ke</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink bg-surface"
            >
              <option value="">Belum ditentukan</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">Status Awal</label>
            <div className="flex gap-2">
              {workflowStages.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                  style={
                    status === s.key
                      ? { backgroundColor: `${workflowStageColor(workflowStages, s.key)}18`, color: workflowStageColor(workflowStages, s.key), borderColor: workflowStageColor(workflowStages, s.key) }
                      : { borderColor: "#DEE5E7", color: "#5C7079" }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {customFields.length > 0 && (
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-inkMuted">
                Field Tambahan
              </p>
              {customFields.map((f) => (
                <div key={f.id}>
                  <label className="block text-xs font-semibold mb-1.5">
                    {f.field_label}
                    {f.is_required && <span className="text-[#8A3E24]"> *</span>}
                  </label>
                  {f.field_type === "select" ? (
                    <select
                      value={customValues[f.field_key] ?? ""}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [f.field_key]: e.target.value }))
                      }
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink bg-surface"
                    >
                      <option value="">Pilih...</option>
                      {(f.field_options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                      value={customValues[f.field_key] ?? ""}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [f.field_key]: e.target.value }))
                      }
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {pendingChecklist.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-inkMuted mb-2">
                Checklist dari template ({pendingChecklist.length} item)
              </p>
              <ul className="space-y-1">
                {pendingChecklist.map((item, i) => (
                  <li key={i} className="text-sm text-inkMuted">• {item.label}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <label className="block text-xs font-semibold mb-1.5">Simpan isian ini sebagai template</label>
            <div className="flex gap-2">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nama template, mis. Onboarding Karyawan Baru"
                className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim() || !title.trim() || savingTemplate}
                className="text-xs font-semibold px-3 rounded-lg border border-border disabled:opacity-40 hover:bg-surfaceAlt shrink-0"
              >
                {savingTemplate ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
            {templateSaved && <p className="text-xs text-[#2F9E7A] mt-1.5">✓ Template tersimpan</p>}
          </div>

          {error && <p className="text-xs text-[#8A3E24]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={resetAndClose}
            className="text-sm font-semibold px-4 py-2 rounded-lg text-inkMuted hover:bg-surfaceAlt transition"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40 transition"
            style={{ backgroundColor: labels.accent }}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
