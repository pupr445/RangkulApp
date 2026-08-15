"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ChecklistItem,
  DependencyTask,
  addChecklistItem,
  addDependency,
  deleteChecklistItem,
  fetchChecklist,
  fetchDependencies,
  fetchWatchers,
  isBlockedByDependencies,
  removeDependency,
  toggleChecklistItem,
  unwatchTask,
  watchTask,
} from "@/lib/data/task-engine";

// ---------------------------------------------------------------------
// CHECKLIST / SUBTASK
// ---------------------------------------------------------------------
export function TaskChecklist({
  taskId,
  organizationId,
  userId,
}: {
  taskId: string;
  organizationId: string;
  userId: string;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchChecklist(supabase, taskId).then((rows) => {
      if (active) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const done = items.filter((i) => i.is_done).length;

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setAdding(true);
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const { error } = await addChecklistItem(supabase, { taskId, organizationId, label, position, userId });
    setAdding(false);
    if (!error) {
      setNewLabel("");
      setItems(await fetchChecklist(supabase, taskId));
    }
  }

  async function handleToggle(item: ChecklistItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)));
    await toggleChecklistItem(supabase, item.id, !item.is_done);
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteChecklistItem(supabase, id);
  }

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-inkMuted">Checklist</p>
        {items.length > 0 && (
          <span className="text-[11px] font-semibold text-inkMuted">
            {done}/{items.length}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-inkMuted">Memuat…</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={item.is_done}
                onChange={() => handleToggle(item)}
                className="w-4 h-4 rounded border-border shrink-0"
              />
              <span className={`text-sm flex-1 ${item.is_done ? "line-through text-inkMuted" : ""}`}>
                {item.label}
              </span>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-xs text-inkMuted opacity-0 group-hover:opacity-100 hover:text-[#8A3E24] transition px-1"
                aria-label={`Hapus ${item.label}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Tambah item checklist…"
          className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-ink"
        />
        <button
          onClick={handleAdd}
          disabled={!newLabel.trim() || adding}
          className="text-xs font-semibold px-3 rounded-lg border border-border disabled:opacity-40 hover:bg-surfaceAlt"
        >
          Tambah
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// DEPENDENCY ("diblokir oleh")
// ---------------------------------------------------------------------
export function TaskDependencies({
  taskId,
  organizationId,
  otherTasks,
  finalStageKey,
  onBlockedChange,
}: {
  taskId: string;
  organizationId: string;
  otherTasks: { id: string; title: string; status: string }[];
  finalStageKey: string | null;
  /** Dipanggil setiap kali status blocked berubah, supaya modal induk bisa menampilkan peringatan. */
  onBlockedChange?: (blocked: boolean) => void;
}) {
  const supabase = createClient();
  const [deps, setDeps] = useState<DependencyTask[]>([]);
  const [picking, setPicking] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchDependencies(supabase, taskId).then((rows) => {
      if (active) {
        setDeps(rows);
        setLoading(false);
        onBlockedChange?.(isBlockedByDependencies(rows, finalStageKey));
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const pickable = otherTasks.filter((t) => t.id !== taskId && !deps.some((d) => d.id === t.id));

  async function handleAdd() {
    if (!picking) return;
    const { error } = await addDependency(supabase, { taskId, dependsOnTaskId: picking, organizationId });
    if (!error) {
      const next = await fetchDependencies(supabase, taskId);
      setDeps(next);
      onBlockedChange?.(isBlockedByDependencies(next, finalStageKey));
      setPicking("");
    }
  }

  async function handleRemove(dependsOnTaskId: string) {
    await removeDependency(supabase, taskId, dependsOnTaskId);
    const next = deps.filter((d) => d.id !== dependsOnTaskId);
    setDeps(next);
    onBlockedChange?.(isBlockedByDependencies(next, finalStageKey));
  }

  if (loading) return null;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-inkMuted">Diblokir oleh</p>

      {deps.length > 0 && (
        <div className="space-y-1.5">
          {deps.map((d) => {
            const isDone = finalStageKey !== null && d.status === finalStageKey;
            return (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <span className={isDone ? "text-[#2F9E7A]" : "text-[#B36B2E]"}>{isDone ? "✓" : "●"}</span>
                <span className="flex-1">{d.title}</span>
                <button
                  onClick={() => handleRemove(d.id)}
                  className="text-xs text-inkMuted hover:text-[#8A3E24] transition px-1"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pickable.length > 0 && (
        <div className="flex gap-2">
          <select
            value={picking}
            onChange={(e) => setPicking(e.target.value)}
            className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-ink bg-surface"
          >
            <option value="">Pilih tugas prasyarat…</option>
            {pickable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!picking}
            className="text-xs font-semibold px-3 rounded-lg border border-border disabled:opacity-40 hover:bg-surfaceAlt"
          >
            Tambah
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// WATCHER
// ---------------------------------------------------------------------
export function TaskWatchToggle({
  taskId,
  organizationId,
  userId,
}: {
  taskId: string;
  organizationId: string;
  userId: string;
}) {
  const supabase = createClient();
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchWatchers(supabase, taskId).then((ids) => {
      if (active) {
        setWatching(ids.includes(userId));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function toggle() {
    if (watching) {
      setWatching(false);
      await unwatchTask(supabase, taskId, userId);
    } else {
      setWatching(true);
      await watchTask(supabase, { taskId, organizationId, userId });
    }
  }

  if (loading) return null;

  return (
    <button
      onClick={toggle}
      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:bg-surfaceAlt transition flex items-center gap-1.5"
      aria-pressed={watching}
    >
      <span>{watching ? "🔔" : "🔕"}</span>
      {watching ? "Mengikuti" : "Ikuti tugas ini"}
    </button>
  );
}
