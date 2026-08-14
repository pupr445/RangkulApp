"use client";

import { useMemo, useState } from "react";
import { useLabels, useWorkflowStages } from "@/lib/labels/LabelProvider";
import { FlatTask } from "@/lib/data/flat-tasks";
import { TaskDetailModal, EditableTask } from "@/components/TaskDetailModal";
import { NewTaskModal } from "@/components/NewTaskModal";
import { MemberOption } from "@/lib/data/members";
import { CustomFieldDef } from "@/lib/data/custom-fields";
import { TeamOption } from "@/lib/data/teams";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const WEEKDAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Bangun grid 6x7 (Senin—Minggu) untuk bulan yang diberikan, termasuk hari dari bulan sebelum/sesudah untuk mengisi baris. */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  // getDay(): 0=Minggu..6=Sabtu. Kita mau grid mulai Senin.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Senin
  const start = new Date(year, month, 1 - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

export function CalendarView({
  tasks,
  organizationId,
  isSample = false,
  members = [],
  customFields = [],
  teams = [],
}: {
  tasks: FlatTask[];
  organizationId?: string;
  isSample?: boolean;
  members?: MemberOption[];
  customFields?: CustomFieldDef[];
  teams?: TeamOption[];
}) {
  const labels = useLabels();
  const workflowStages = useWorkflowStages();
  const STATUS_LABEL: Record<string, string> = Object.fromEntries(workflowStages.map((s) => [s.key, s.label]));
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, FlatTask[]>();
    for (const t of tasks) {
      if (!t.due || t.due === "-") continue;
      const list = map.get(t.due) ?? [];
      list.push(t);
      map.set(t.due, list);
    }
    return map;
  }, [tasks]);

  const grid = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const todayISO = toISODate(today);
  const selectedTasks = selectedDate ? tasksByDate.get(selectedDate) ?? [] : [];

  function goPrevMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }
  function goNextMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }
  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(toISODate(now));
  }

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-bold">Kalender</h1>
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
        {labels.taskLabel} yang punya tenggat, ditampilkan per tanggal.
        {isSample && " (data contoh — belum bisa diedit)"}
      </p>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrevMonth}
            aria-label="Bulan sebelumnya"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-sm hover:bg-surfaceAlt"
          >
            ‹
          </button>
          <span className="text-sm font-semibold w-40 text-center">
            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button
            onClick={goNextMonth}
            aria-label="Bulan berikutnya"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-sm hover:bg-surfaceAlt"
          >
            ›
          </button>
        </div>
        <button
          onClick={goToday}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border"
          style={{ borderColor: labels.accent, color: labels.accent }}
        >
          Hari Ini
        </button>
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_NAMES.map((wd) => (
            <div key={wd} className="text-[11px] font-semibold uppercase text-inkMuted text-center py-2">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((date, idx) => {
            const iso = toISODate(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            const isToday = iso === todayISO;
            const isSelected = iso === selectedDate;
            const dayTasks = tasksByDate.get(iso) ?? [];

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(iso)}
                className={`text-left border-b border-r border-border p-2 min-h-[84px] align-top transition ${
                  inMonth ? "bg-surface" : "bg-surfaceAlt/40"
                } ${isSelected ? "ring-2 ring-inset" : "hover:bg-surfaceAlt"}`}
                style={isSelected ? ({ ["--tw-ring-color" as string]: labels.accent } as React.CSSProperties) : undefined}
              >
                <span
                  className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    !inMonth ? "text-inkMuted" : ""
                  }`}
                  style={isToday ? { backgroundColor: labels.accent, color: "white" } : undefined}
                >
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className="text-[10.5px] font-medium truncate px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: labels.accentSoft, color: labels.accent }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10.5px] text-inkMuted px-1.5">+{dayTasks.length - 3} lagi</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">
              {labels.taskLabel} pada {selectedDate}
            </h2>
            {organizationId && !isSample && (
              <button
                onClick={() => setModalOpen(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                style={{ borderColor: labels.accent, color: labels.accent }}
              >
                + Tambah untuk tanggal ini
              </button>
            )}
          </div>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-inkMuted">
              Tidak ada {labels.taskLabel.toLowerCase()} dengan tenggat di tanggal ini.
            </p>
          ) : (
            <div className="bg-surface border border-border rounded-card overflow-hidden">
              {selectedTasks.map((task, idx) => (
                <div
                  key={task.id}
                  onClick={() => {
                    if (isSample) return;
                    setEditingTask(task);
                  }}
                  className={`flex items-center justify-between gap-4 px-5 py-3.5 flex-wrap ${
                    idx !== selectedTasks.length - 1 ? "border-b border-border" : ""
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
                    <span className="px-2 py-0.5 rounded-full border" style={{ borderColor: "#DEE5E7" }}>
                      {STATUS_LABEL[task.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {organizationId && (
        <>
          <NewTaskModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            organizationId={organizationId}
            members={members}
            customFields={customFields}
            teams={teams}
            defaultDueDate={selectedDate ?? undefined}
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
