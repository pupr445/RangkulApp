"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLabels } from "@/lib/labels/LabelProvider";
import { FlatTask } from "@/lib/data/flat-tasks";
import { NewTaskModal } from "@/components/NewTaskModal";
import { TaskDetailModal, EditableTask } from "@/components/TaskDetailModal";
import { createClient } from "@/lib/supabase/client";
import { MemberOption } from "@/lib/data/members";
import { CustomFieldDef } from "@/lib/data/custom-fields";

const STATUS_LABEL: Record<FlatTask["status"], string> = {
  todo: "Belum Dikerjakan",
  doing: "Sedang Dikerjakan",
  done: "Selesai",
};

export function TaskList({
  tasks,
  organizationId,
  isSample = false,
  members = [],
  customFields = [],
}: {
  tasks: FlatTask[];
  organizationId?: string;
  isSample?: boolean;
  members?: MemberOption[];
  customFields?: CustomFieldDef[];
}) {
  const labels = useLabels();
  const router = useRouter();
  const supabase = createClient();

  const [filter, setFilter] = useState<"all" | FlatTask["status"]>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  );

  const tabs: { key: "all" | FlatTask["status"]; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "todo", label: STATUS_LABEL.todo },
    { key: "doing", label: STATUS_LABEL.doing },
    { key: "done", label: STATUS_LABEL.done },
  ];

  async function quickChangeStatus(taskId: string, status: FlatTask["status"]) {
    if (isSample || !organizationId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    await client.from("tasks").update({ status }).eq("id", taskId).eq("organization_id", organizationId);
    router.refresh();
  }

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-bold">{labels.navTask}</h1>
        <button
          onClick={() => setModalOpen(true)}
          disabled={!organizationId}
          className="text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40"
          style={{ backgroundColor: labels.accent }}
        >
          {labels.newTaskCta}
        </button>
      </div>
      <p className="text-sm text-inkMuted mb-6">
        Semua {labels.taskLabel.toLowerCase()} di seluruh {labels.teamLabel.toLowerCase()}, dalam satu tempat.
        {isSample && " (data contoh — belum bisa diedit)"}
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
              style={
                active
                  ? { backgroundColor: labels.accentSoft, color: labels.accent, borderColor: labels.accent }
                  : { borderColor: "var(--tw-border, #DEE5E7)", color: "#5C7079" }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {filtered.length === 0 && (
          <p className="text-sm text-inkMuted p-6 text-center">
            Tidak ada {labels.taskLabel.toLowerCase()} pada filter ini.
          </p>
        )}
        {filtered.map((task, idx) => (
          <div
            key={task.id}
            onClick={() => {
              if (isSample) return;
              setEditingTask(task);
            }}
            className={`flex items-center justify-between gap-4 px-5 py-3.5 flex-wrap ${
              idx !== filtered.length - 1 ? "border-b border-border" : ""
            } ${isSample ? "" : "cursor-pointer hover:bg-surfaceAlt"}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="text-[10.5px] font-bold px-2 py-0.5 rounded shrink-0"
                style={{ backgroundColor: labels.accentSoft, color: labels.accent }}
              >
                {task.tag}
              </span>
              <span className="text-sm font-medium truncate">{task.title}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-inkMuted shrink-0">
              <span>{task.assignee}</span>
              {isSample ? (
                <span className="px-2 py-0.5 rounded-full border" style={{ borderColor: "#DEE5E7" }}>
                  {STATUS_LABEL[task.status]}
                </span>
              ) : (
                <select
                  value={task.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => quickChangeStatus(task.id, e.target.value as FlatTask["status"])}
                  className="text-xs border border-border rounded-full px-2 py-0.5 bg-surface outline-none"
                >
                  {(Object.keys(STATUS_LABEL) as FlatTask["status"][]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}
              <span>{task.due}</span>
            </div>
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
          />
          <TaskDetailModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            organizationId={organizationId}
            members={members}
            customFields={customFields}
          />
        </>
      )}
    </main>
  );
}
