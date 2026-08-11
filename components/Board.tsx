"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLabels } from "@/lib/labels/LabelProvider";
import { BoardColumn } from "@/lib/data/sample-tasks";
import { NewTaskModal } from "@/components/NewTaskModal";
import { TaskDetailModal, EditableTask } from "@/components/TaskDetailModal";
import { createClient } from "@/lib/supabase/client";
import { MemberOption } from "@/lib/data/members";
import { CustomFieldDef } from "@/lib/data/custom-fields";
import { TeamOption } from "@/lib/data/teams";

const STATUS_OPTIONS: { key: "todo" | "doing" | "done"; label: string }[] = [
  { key: "todo", label: "Belum Dikerjakan" },
  { key: "doing", label: "Sedang Dikerjakan" },
  { key: "done", label: "Selesai" },
];

export function Board({
  title,
  subtitle,
  columns,
  organizationId,
  isSample = false,
  members = [],
  customFields = [],
  teams = [],
}: {
  title: string;
  subtitle: string;
  columns: BoardColumn[];
  organizationId?: string;
  isSample?: boolean;
  members?: MemberOption[];
  customFields?: CustomFieldDef[];
  teams?: TeamOption[];
}) {
  const labels = useLabels();
  const router = useRouter();
  const supabase = createClient();

  const [cols, setCols] = useState(columns);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Sinkron ulang saat props berubah (misalnya setelah router.refresh())
  useEffect(() => setCols(columns), [columns]);

  const visibleCols =
    teamFilter === "all"
      ? cols
      : cols.map((c) => ({ ...c, cards: c.cards.filter((card) => card.teamId === teamFilter) }));

  async function moveCard(cardId: string, fromColId: string, toColId: string) {
    if (isSample || !organizationId || fromColId === toColId) return;

    // Update optimistis di UI dulu supaya terasa instan...
    setCols((prev) => {
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const fromCol = next.find((c) => c.id === fromColId);
      const toCol = next.find((c) => c.id === toColId);
      if (!fromCol || !toCol) return prev;
      const idx = fromCol.cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return prev;
      const [card] = fromCol.cards.splice(idx, 1);
      toCol.cards.unshift(card);
      return next;
    });

    // ...lalu simpan ke database. Kolom "todo"/"doing"/"done" = nilai kolom `status`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { error } = await client
      .from("tasks")
      .update({ status: toColId })
      .eq("id", cardId)
      .eq("organization_id", organizationId);

    if (error) {
      // Gagal simpan -> tarik ulang data asli dari server supaya UI tidak
      // "berbohong" (menampilkan posisi yang sebenarnya tidak tersimpan).
      router.refresh();
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{title}</h1>
          <p className="text-sm text-inkMuted">{subtitle}</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={!organizationId}
          className="text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40"
          style={{ backgroundColor: labels.accent }}
        >
          {labels.newTaskCta}
        </button>
      </div>

      {isSample && (
        <p className="text-xs text-inkMuted bg-surfaceAlt border border-border rounded-lg px-3.5 py-2 mb-4">
          Ini data contoh — geser/edit tidak akan tersimpan. Buat {labels.taskLabel.toLowerCase()} baru untuk mencoba fitur ini sungguhan.
        </p>
      )}

      {teams.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs font-semibold text-inkMuted">Filter {labels.teamLabel}:</label>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-surface outline-none"
          >
            <option value="all">Semua {labels.teamLabelPlural}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCols.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => {
              if (isSample) return;
              e.preventDefault();
              setDragOverCol(col.id);
            }}
            onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              if (isSample) return;
              e.preventDefault();
              const cardId = e.dataTransfer.getData("text/plain");
              const fromColId = cols.find((c) => c.cards.some((cd) => cd.id === cardId))?.id;
              setDragOverCol(null);
              if (cardId && fromColId) moveCard(cardId, fromColId, col.id);
            }}
            className="bg-surfaceAlt rounded-card p-3 min-h-[120px] transition"
            style={dragOverCol === col.id ? { outline: `2px dashed ${labels.accent}`, outlineOffset: "-2px" } : undefined}
          >
            <div className="flex items-center gap-2 px-1.5 pb-3 text-xs font-bold uppercase tracking-wide text-inkMuted">
              <span>{col.name}</span>
              <span className="bg-surface border border-border rounded-full px-2 py-0.5 text-[11px]">
                {col.cards.length}
              </span>
            </div>
            {col.cards.map((card) => (
              <div
                key={card.id}
                draggable={!isSample}
                onDragStart={(e) => {
                  setDraggingId(card.id);
                  e.dataTransfer.setData("text/plain", card.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                onClick={() => {
                  if (isSample) return;
                  setEditingTask({
                    id: card.id,
                    title: card.title,
                    tag: card.tag,
                    due: card.due,
                    status: col.id as "todo" | "doing" | "done",
                    assigneeId: card.assigneeId,
                    teamId: card.teamId,
                    customData: card.customData,
                  });
                }}
                className={`bg-surface border border-border rounded-lg p-3 mb-2.5 shadow-card transition ${
                  isSample ? "" : "cursor-pointer hover:border-ink"
                } ${draggingId === card.id ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className="inline-block text-[10.5px] font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: labels.accentSoft, color: labels.accent }}
                  >
                    {card.tag}
                  </span>
                  {!isSample && (
                    <select
                      value={col.id}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => moveCard(card.id, col.id, e.target.value)}
                      className="text-[10.5px] border border-border rounded px-1.5 py-0.5 text-inkMuted bg-surface outline-none"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="text-sm font-semibold leading-snug mb-2">{card.title}</div>
                <div className="flex items-center justify-between text-xs text-inkMuted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-[18px] h-[18px] rounded-full bg-surfaceAlt border border-border text-[9px] font-bold flex items-center justify-center">
                      {card.assigneeInitials}
                    </span>
                    {card.assignee}
                  </span>
                  <span>{card.due}</span>
                </div>
              </div>
            ))}
            {col.cards.length === 0 && (
              <p className="text-xs text-inkMuted px-1.5 py-3">Belum ada item.</p>
            )}
          </div>
        ))}
      </div>

      {organizationId && (
        <>
          <NewTaskModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            organizationId={organizationId}
            members={members}
            customFields={customFields}
            teams={teams}
          />
          <TaskDetailModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            organizationId={organizationId}
            members={members}
            customFields={customFields}
            teams={teams}
          />
        </>
      )}
    </main>
  );
}
