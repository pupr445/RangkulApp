"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { logActivity } from "@/lib/data/activity-log";
import { WorkflowStage } from "@/lib/data/workflows";

function keyFromLabel(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
}

export function WorkflowManager({ organizationId, stages }: { organizationId: string; stages: WorkflowStage[] }) {
  const labels = useLabels();
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<WorkflowStage[]>(stages);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => items.length >= 2 && items.every((x) => x.key && x.label), [items]);

  function updateItem(index: number, patch: Partial<WorkflowStage>) {
    setItems((prev) => prev.map((x, i) => (i === index ? { ...x, ...patch } : x)));
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
    setItems((prev) => [...prev, { key, label: nextLabel }]);
    setLabel("");
    setError(null);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    if (items.length <= 2) {
      setError("Workflow minimal memiliki 2 tahap.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await (supabase as any)
      .from("organizations")
      .update({ workflow_stages: items })
      .eq("id", organizationId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    logActivity(supabase, {
      organizationId,
      actorId: currentUserId,
      actorName: "Admin",
      action: "workflow.updated",
      targetType: "organization",
      targetId: organizationId,
      targetLabel: labels.sectorDisplayName,
    });
    router.refresh();
  }

  return (
    <div className="bg-surface border border-border rounded-card p-5 mb-6">
      <h2 className="text-sm font-semibold mb-1">Workflow {labels.taskLabel}</h2>
      <p className="text-xs text-inkMuted mb-4">Atur tahapan kerja yang benar-benar sesuai sektor organisasi. Task akan menggunakan tahap di bawah ini.</p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.key} className="flex gap-2 items-center border border-border rounded-lg p-2">
            <div className="w-7 text-center text-xs font-bold text-inkMuted">{index + 1}</div>
            <input value={item.label} onChange={(e) => updateItem(index, { label: e.target.value })} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
            <button onClick={() => move(index, -1)} disabled={index === 0} className="text-xs px-2 py-1 border border-border rounded disabled:opacity-30">↑</button>
            <button onClick={() => move(index, 1)} disabled={index === items.length - 1} className="text-xs px-2 py-1 border border-border rounded disabled:opacity-30">↓</button>
            <button onClick={() => remove(index)} className="text-xs px-2 py-1 text-[#8A3E24]">Hapus</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addStage(); }} placeholder="Tambah tahap, mis. Menunggu Hasil" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
        <button onClick={addStage} className="border border-border rounded-lg px-4 py-2 text-sm font-semibold">+ Tahap</button>
      </div>
      {error && <p className="text-xs text-[#8A3E24] mt-2">{error}</p>}
      <div className="flex justify-end mt-4">
        <button onClick={save} disabled={saving || !canSave} className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: labels.accent }}>
          {saving ? "Menyimpan…" : "Simpan Workflow"}
        </button>
      </div>
    </div>
  );
}
