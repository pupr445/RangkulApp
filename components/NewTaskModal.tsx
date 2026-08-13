"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/lib/labels/LabelProvider";
import { MemberOption } from "@/lib/data/members";
import { CustomFieldDef } from "@/lib/data/custom-fields";
import { TeamOption } from "@/lib/data/teams";

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
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"todo" | "doing" | "done">("todo");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setStatus("todo");
    setAssigneeId("");
    setTeamId("");
    setCustomValues({});
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!title.trim()) return;

    const missingRequired = customFields.find(
      (f) => f.is_required && !customValues[f.field_key]?.trim()
    );
    if (missingRequired) {
      setError(`"${missingRequired.field_label}" wajib diisi.`);
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("tasks").insert([
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
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
