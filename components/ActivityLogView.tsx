"use client";

import { useMemo, useState } from "react";
import { useLabels } from "@/lib/labels/LabelProvider";
import {
  ActivityLogEntry,
  SecurityAuditEntry,
  describeActivity,
} from "@/lib/data/activity-log";

const TARGET_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "task", label: "Tugas" },
  { key: "team", label: "Tim" },
  { key: "member", label: "Anggota" },
  { key: "custom_field", label: "Field" },
  { key: "document", label: "Dokumen" },
  { key: "template", label: "Template" },
];

const AUDIT_ACTIONS = [
  { key: "", label: "Semua aksi" },
  { key: "team.member_added", label: "Tambah anggota tim" },
  { key: "team.member_removed", label: "Hapus anggota tim" },
  { key: "workflow.updated", label: "Perubahan workflow" },
  { key: "template.created", label: "Buat template" },
  { key: "template.applied", label: "Terapkan template" },
  { key: "member.invited", label: "Undang anggota" },
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

function auditDescription(entry: SecurityAuditEntry) {
  const actor = entry.actor_name ?? "Seseorang";
  const label = entry.target_label ? ` "${entry.target_label}"` : "";
  const detail = entry.detail ? ` — ${entry.detail}` : "";
  const actionMap: Record<string, string> = {
    "team.member_added": "menambahkan anggota ke",
    "team.member_removed": "mengeluarkan anggota dari",
    "workflow.updated": "mengubah workflow untuk",
    "template.created": "membuat template",
    "template.applied": "menerapkan template",
    "member.invited": "mengundang anggota",
  };
  return `${actor} ${actionMap[entry.action] ?? entry.action}${label}${detail}`;
}

export function ActivityLogView({
  entries,
  auditEntries,
  teams,
  members,
  canAudit,
  isSample = false,
}: {
  entries: ActivityLogEntry[];
  auditEntries: SecurityAuditEntry[];
  teams: { id: string; name: string }[];
  members: { id: string; name: string | null }[];
  canAudit: boolean;
  isSample?: boolean;
}) {
  const labels = useLabels();
  const [mode, setMode] = useState<"activity" | "audit">("activity");
  const [targetFilter, setTargetFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredActivity = useMemo(() => {
    return entries.filter((e) => {
      if (targetFilter !== "all" && e.target_type !== targetFilter) return false;
      if (actorFilter && e.actor_id !== actorFilter) return false;
      if (teamFilter && e.team_id !== teamFilter) return false;
      if (fromDate && e.created_at < `${fromDate}T00:00:00`) return false;
      if (toDate && e.created_at > `${toDate}T23:59:59.999`) return false;
      return true;
    });
  }, [entries, targetFilter, actorFilter, teamFilter, fromDate, toDate]);

  const filteredAudit = useMemo(() => {
    return auditEntries.filter((e) => {
      if (actorFilter && e.actor_id !== actorFilter) return false;
      if (teamFilter && e.team_id !== teamFilter) return false;
      if (auditAction && e.action !== auditAction) return false;
      if (fromDate && e.created_at < `${fromDate}T00:00:00`) return false;
      if (toDate && e.created_at > `${toDate}T23:59:59.999`) return false;
      return true;
    });
  }, [auditEntries, actorFilter, teamFilter, auditAction, fromDate, toDate]);

  function resetFilters() {
    setTargetFilter("all");
    setActorFilter("");
    setTeamFilter("");
    setAuditAction("");
    setFromDate("");
    setToDate("");
  }

  const actorOptions = useMemo(
    () =>
      members.length
        ? members
        : Array.from(
            new Map(
              [...entries, ...auditEntries]
                .filter((e) => e.actor_id)
                .map((e) => [e.actor_id as string, { id: e.actor_id as string, name: e.actor_name }]),
            ).values(),
          ),
    [members, entries, auditEntries],
  );

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold mb-1">{mode === "activity" ? "Aktivitas Tim" : "Security Audit"}</h1>
            <p className="text-sm text-inkMuted">
              {mode === "activity"
                ? "Riwayat pekerjaan dan perubahan operasional organisasi."
                : "Perubahan sensitif yang perlu dapat dilacak oleh Owner/Manager."}
              {isSample && " (akan terisi setelah kamu bergabung/membuat organisasi)"}
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-border p-1 bg-surface">
            <button
              onClick={() => setMode("activity")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === "activity" ? "text-white" : "text-inkMuted"}`}
              style={mode === "activity" ? { backgroundColor: labels.accent } : undefined}
            >
              Aktivitas
            </button>
            {canAudit && (
              <button
                onClick={() => setMode("audit")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === "audit" ? "text-white" : "text-inkMuted"}`}
                style={mode === "audit" ? { backgroundColor: labels.accent } : undefined}
              >
                Audit Keamanan
              </button>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-4 mb-5">
          <div className="flex flex-wrap gap-2 mb-3">
            {mode === "activity" &&
              TARGET_TABS.map((t) => {
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
            {mode === "audit" &&
              AUDIT_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAuditAction(a.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                    auditAction === a.key ? "text-white border-transparent" : "text-inkMuted border-border"
                  }`}
                  style={auditAction === a.key ? { backgroundColor: labels.accent } : undefined}
                >
                  {a.label}
                </button>
              ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
            >
              <option value="">Semua anggota</option>
              {actorOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? "Tanpa nama"}
                </option>
              ))}
            </select>

            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
            >
              <option value="">Semua tim</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
              aria-label="Tanggal mulai"
            />

            <div className="flex gap-2">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="min-w-0 flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface"
                aria-label="Tanggal akhir"
              />
              <button onClick={resetFilters} className="px-3 py-2 text-xs font-semibold border border-border rounded-lg">
                Reset
              </button>
            </div>
          </div>
        </div>

        {mode === "activity" ? (
          filteredActivity.length === 0 ? (
            <p className="text-sm text-inkMuted">
              {entries.length === 0
                ? "Belum ada aktivitas tercatat. Aktivitas akan muncul saat ada pekerjaan atau perubahan."
                : "Tidak ada aktivitas yang cocok dengan filter ini."}
            </p>
          ) : (
            <div className="bg-surface border border-border rounded-card overflow-hidden">
              {filteredActivity.map((entry, idx) => (
                <div key={entry.id} className={`flex items-start gap-3 px-5 py-3.5 ${idx !== filteredActivity.length - 1 ? "border-b border-border" : ""}`}>
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: labels.accentSoft }}
                  >
                    •
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{describeActivity(entry)}</p>
                    <p className="text-xs text-inkMuted mt-0.5">
                      {relativeTime(entry.created_at)}
                      {entry.team_id ? ` · ${teams.find((t) => t.id === entry.team_id)?.name ?? "Tim"}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredAudit.length === 0 ? (
          <p className="text-sm text-inkMuted">Belum ada audit keamanan yang cocok dengan filter ini.</p>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {filteredAudit.map((entry, idx) => (
              <div key={entry.id} className={`flex items-start gap-3 px-5 py-3.5 ${idx !== filteredAudit.length - 1 ? "border-b border-border" : ""}`}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-red-50 text-red-700">
                  !
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{auditDescription(entry)}</p>
                  <p className="text-xs text-inkMuted mt-0.5">
                    {relativeTime(entry.created_at)}
                    {entry.team_id ? ` · ${teams.find((t) => t.id === entry.team_id)?.name ?? "Tim"}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
