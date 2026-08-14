"use client";

import { useMemo, useState } from "react";
import { FlatTask } from "@/lib/data/flat-tasks";
import { TeamOption } from "@/lib/data/teams";
import { WorkflowStage } from "@/lib/data/workflows";

function isOverdue(due: string, status: string, finalStageKey: string) {
  if (!due || due === "-" || status === finalStageKey) return false;
  const today = new Date().toISOString().slice(0, 10);
  return due < today;
}

export function ReportsInsights({
  tasks,
  teams,
  stages,
  finalStageKey,
  accent,
}: {
  tasks: FlatTask[];
  teams: TeamOption[];
  stages: WorkflowStage[];
  finalStageKey: string;
  accent: string;
}) {
  const [teamFilter, setTeamFilter] = useState("all");

  const visibleTasks = useMemo(
    () => (teamFilter === "all" ? tasks : tasks.filter((task) => task.teamId === teamFilter)),
    [tasks, teamFilter]
  );

  const stageRows = useMemo(
    () =>
      stages.map((stage) => ({
        ...stage,
        count: visibleTasks.filter((task) => task.status === stage.key).length,
      })),
    [stages, visibleTasks]
  );

  const teamRows = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; overdue: number }>();
    for (const team of teams) map.set(team.id, { name: team.name, total: 0, completed: 0, overdue: 0 });

    for (const task of visibleTasks) {
      if (!task.teamId) continue;
      const row = map.get(task.teamId);
      if (!row) continue;
      row.total += 1;
      if (task.status === finalStageKey) row.completed += 1;
      if (isOverdue(task.due, task.status, finalStageKey)) row.overdue += 1;
    }

    return Array.from(map.entries())
      .map(([id, row]) => ({
        id,
        ...row,
        rate: row.total ? Math.round((row.completed / row.total) * 100) : 0,
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [teams, visibleTasks, finalStageKey]);

  const deadlineHealth = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let overdue = 0;
    let todayDue = 0;
    let noDeadline = 0;

    for (const task of visibleTasks) {
      if (task.status === finalStageKey) continue;
      if (!task.due || task.due === "-") {
        noDeadline += 1;
      } else if (task.due < today) {
        overdue += 1;
      } else if (task.due === today) {
        todayDue += 1;
      }
    }

    return { overdue, todayDue, noDeadline };
  }, [visibleTasks, finalStageKey]);

  const maxStage = Math.max(1, ...stageRows.map((row) => row.count));
  const maxTeam = Math.max(1, ...teamRows.map((row) => row.total));

  return (
    <section className="space-y-6 mb-8">
      {teams.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">Insight Tim & Deadline</h2>
            <p className="text-xs text-inkMuted mt-0.5">Bandingkan workload, progres, dan kesehatan tenggat.</p>
          </div>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-surface"
          >
            <option value="all">Semua tim</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="text-sm font-semibold mb-4">Distribusi Workflow</h3>
          <div className="space-y-3">
            {stageRows.map((stage) => {
              const width = Math.round((stage.count / maxStage) * 100);
              return (
                <div key={stage.key}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span>{stage.label}</span>
                    <span className="font-semibold">{stage.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surfaceAlt overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: accent }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="text-sm font-semibold mb-4">Kesehatan Tenggat</h3>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Terlambat" value={deadlineHealth.overdue} />
            <MiniStat label="Hari ini" value={deadlineHealth.todayDue} />
            <MiniStat label="Tanpa tenggat" value={deadlineHealth.noDeadline} />
          </div>
          <p className="text-[11px] text-inkMuted mt-4">
            Task selesai tidak dihitung sebagai terlambat. Angka mengikuti filter tim yang dipilih.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card p-5">
        <h3 className="text-sm font-semibold mb-4">Workload per Tim</h3>
        {teamRows.length === 0 ? (
          <p className="text-sm text-inkMuted">Belum ada task yang terhubung ke tim.</p>
        ) : (
          <div className="space-y-4">
            {teamRows.map((row) => (
              <div key={row.id}>
                <div className="flex justify-between items-center text-xs mb-1.5 gap-4">
                  <span className="font-medium truncate">{row.name}</span>
                  <span className="text-inkMuted whitespace-nowrap">
                    {row.total} task · {row.rate}% selesai · {row.overdue} terlambat
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surfaceAlt overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(6, Math.round((row.total / maxTeam) * 100))}%`, backgroundColor: accent }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surfaceAlt p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-inkMuted mt-0.5">{label}</div>
    </div>
  );
}
