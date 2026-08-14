"use client";

import { useMemo, useState } from "react";
import { useLabels } from "@/lib/labels/LabelProvider";
import { ActivityLogEntry, describeActivity } from "@/lib/data/activity-log";

const ACTION_ICON: Record<string, string> = {
  "task.created": "✅",
  "task.status_changed": "🔄",
  "task.deleted": "🗑️",
  "team.created": "📋",
  "team.deleted": "🗑️",
  "team.member_added": "👤",
  "team.member_removed": "👤",
  "member.invited": "✉️",
  "custom_field.created": "🧩",
  "document.uploaded": "📁",
};

const TARGET_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "task", label: "Tugas" },
  { key: "team", label: "Tim" },
  { key: "member", label: "Anggota" },
  { key: "custom_field", label: "Field" },
  { key: "document", label: "Dokumen" },
];

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function ActivityLogView({ entries, isSample = false }: { entries: ActivityLogEntry[]; isSample?: boolean }) {
  const labels = useLabels();
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [actorQuery, setActorQuery] = useState("");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (targetFilter !== "all" && e.target_type !== targetFilter) return false;
      if (actorQuery.trim() && !(e.actor_name ?? "").toLowerCase().includes(actorQuery.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [entries, targetFilter, actorQuery]);

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <h1 className="text-2xl font-bold mb-1">Aktivitas Tim</h1>
      <p className="text-sm text-inkMuted mb-6">
        Riwayat aktivitas penting di organisasi ini — siapa mengerjakan apa, dan kapan.
        {isSample && " (belum ada organisasi — halaman ini akan terisi setelah kamu bergabung/membuat organisasi)"}
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1.5 flex-wrap">
          {TARGET_TABS.map((t) => {
            const active = targetFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTargetFilter(t.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                  active ? "text-white border-transparent" : "text-inkMuted border-border hover:bg-surfaceAlt"
                }`}
                style={active ? { backgroundColor: labels.accent } : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <input
          value={actorQuery}
          onChange={(e) => setActorQuery(e.target.value)}
          placeholder="Cari nama anggota..."
          className="ml-auto text-sm border border-border rounded-lg px-3 py-1.5 outline-none focus:border-ink w-full sm:w-56"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-inkMuted">
          {entries.length === 0
            ? "Belum ada aktivitas tercatat. Aktivitas akan mulai muncul di sini begitu ada yang membuat tugas, mengubah status, membuat tim, atau mengunggah dokumen."
            : "Tidak ada aktivitas yang cocok dengan filter ini."}
        </p>
      ) : (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          {filtered.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-start gap-3 px-5 py-3.5 ${
                idx !== filtered.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{ backgroundColor: labels.accentSoft }}
              >
                {ACTION_ICON[entry.action] ?? "•"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{describeActivity(entry)}</p>
                <p className="text-xs text-inkMuted mt-0.5">{relativeTime(entry.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
