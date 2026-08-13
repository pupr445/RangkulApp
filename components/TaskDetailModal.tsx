"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCanManage, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { MemberOption } from "@/lib/data/members";
import { CustomFieldDef } from "@/lib/data/custom-fields";
import { TeamOption } from "@/lib/data/teams";

export interface EditableTask {
  id: string;
  title: string;
  tag: string;
  due: string; // "-" atau ISO date (yyyy-mm-dd)
  status: "todo" | "doing" | "done";
  assigneeId?: string;
  teamId?: string;
  customData?: Record<string, string>;
}

export function TaskDetailModal({
  task,
  onClose,
  organizationId,
  members = [],
  customFields = [],
  teams = [],
}: {
  task: EditableTask | null;
  onClose: () => void;
  organizationId: string;
  members?: MemberOption[];
  customFields?: CustomFieldDef[];
  teams?: TeamOption[];
}) {
  const labels = useLabels();
  const canManage = useCanManage();
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(task?.title ?? "");
  const [tag, setTag] = useState(task?.tag ?? "");
  const [dueDate, setDueDate] = useState(task?.due && task.due !== "-" ? task.due : "");
  const [status, setStatus] = useState<"todo" | "doing" | "done">(task?.status ?? "todo");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [teamId, setTeamId] = useState(task?.teamId ?? "");
  const [customValues, setCustomValues] = useState<Record<string, string>>(task?.customData ?? {});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sinkronkan state form setiap kali task berganti (modal dibuka untuk kartu lain)
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setTag(task.tag);
      setDueDate(task.due && task.due !== "-" ? task.due : "");
      setStatus(task.status);
      setAssigneeId(task.assigneeId ?? "");
      setTeamId(task.teamId ?? "");
      setCustomValues(task.customData ?? {});
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;

  const canDelete = canManage || task.assigneeId === currentUserId;

  async function handleSave() {
    if (!title.trim() || !task) return;

    const missingRequired = customFields.find(
      (f) => f.is_required && !customValues[f.field_key]?.trim()
    );
    if (missingRequired) {
      setError(`"${missingRequired.field_label}" wajib diisi.`);
      return;
    }

    setSaving(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { error: updateError } = await client
      .from("tasks")
      .update({
        title: title.trim(),
        tag: tag.trim() || "Umum",
        due_date: dueDate || null,
        status,
        assignee_id: assigneeId || null,
        team_id: teamId || null,
        custom_data: customValues,
      })
      .eq("id", task.id)
      .eq("organization_id", organizationId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Hapus "${task.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id)
      .eq("organization_id", organizationId);

    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card shadow-card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1">Edit {labels.taskLabel}</h2>
        <p className="text-xs text-inkMuted mb-5">Ubah detail atau hapus {labels.taskLabel.toLowerCase()} ini.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Judul</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Kategori</label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
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
            <label className="block text-xs font-semibold mb-1.5">Status</label>
            <div className="flex gap-2">
              {(
                [
                  { key: "todo", label: labels.statusLabels.todo },
                  { key: "doing", label: labels.statusLabels.doing },
                  { key: "done", label: labels.statusLabels.done },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                  style={
                    status === s.key
                      ? { backgroundColor: labels.accentSoft, color: labels.accent, borderColor: labels.accent }
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

          {error && <p className="text-xs text-[#8A3E24]">{error}</p>}
          {!canDelete && (
            <p className="text-xs text-inkMuted">
              {labels.taskLabel} ini ditugaskan ke orang lain — kamu hanya bisa melihat, tidak bisa mengubah.
            </p>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 mt-6">
          {canDelete ? (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-[#8A3E24] hover:bg-[#FBEAE5] disabled:opacity-40 transition"
            >
              {deleting ? "Menghapus…" : "Hapus"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-inkMuted hover:bg-surfaceAlt transition"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving || deleting || !canDelete}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40 transition"
              style={{ backgroundColor: labels.accent }}
            >
              {saving ? "Menyimpan…" : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
