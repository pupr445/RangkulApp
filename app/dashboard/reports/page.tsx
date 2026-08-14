import { getCurrentOrg } from "@/lib/data/org";
import { sampleFlatTasksFor, FlatTask } from "@/lib/data/flat-tasks";
import { fetchMemberOptions } from "@/lib/data/members";
import { getLabels } from "@/lib/labels/sectors";
import { ExportButton } from "@/components/ExportButton";
import { normalizeWorkflowStages } from "@/lib/data/workflows";

export const runtime = "edge";

export default async function ReportsPage() {
  const { supabase, user, org } = await getCurrentOrg();
  const sector = org?.sector_type ?? "lainnya";
  const labels = getLabels(sector, org?.label_overrides ?? null);
  const workflowStages = normalizeWorkflowStages(org?.workflow_stages, sector);
  const finalStageKey = workflowStages[workflowStages.length - 1]?.key ?? "done";

  const STATUS_META: Record<string, { label: string; color: string }> = Object.fromEntries(
    workflowStages.map((stage, index) => [stage.key, { label: stage.label, color: index === workflowStages.length - 1 ? "#2F9E7A" : labels.accent }])
  );

  let tasks: FlatTask[] = sampleFlatTasksFor(sector);
  let isSample = true;

  const members = org
    ? await fetchMemberOptions(
        supabase,
        org.id,
        user
          ? {
              id: user.id,
              name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Saya",
            }
          : null
      )
    : [];
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  if (org) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, tag, due_date, assignee_id")
      .eq("organization_id", org.id);

    if (data && data.length > 0) {
      isSample = false;
      tasks = (data as Array<Record<string, unknown>>).map((t) => {
        const assigneeId = (t.assignee_id as string | null) ?? undefined;
        return {
          id: String(t.id),
          title: t.title as string,
          tag: (t.tag as string) ?? "Umum",
          status: ((t.status as string) ?? "todo") as FlatTask["status"],
          due: (t.due_date as string) ?? "-",
          assignee: assigneeId ? memberMap.get(assigneeId) ?? "Anggota" : "Belum ditentukan",
          assigneeId,
        };
      });
    }
  }

  const total = tasks.length;
  const counts: Record<string, number> = Object.fromEntries(workflowStages.map((s) => [s.key, 0]));
  const byTag: Record<string, { total: number; done: number }> = {};
  const byMember: Record<string, { name: string; total: number; statusCounts: Record<string, number>; done: number }> = {};

  for (const t of tasks) {
    counts[t.status] += 1;
    byTag[t.tag] ??= { total: 0, done: 0 };
    byTag[t.tag].total += 1;
    if (t.status === finalStageKey) byTag[t.tag].done += 1;

    const key = t.assigneeId ?? "unassigned";
    byMember[key] ??= { name: t.assignee, total: 0, statusCounts: Object.fromEntries(workflowStages.map((s) => [s.key, 0])), done: 0 };
    byMember[key].total += 1;
    byMember[key].statusCounts[t.status] = (byMember[key].statusCounts[t.status] ?? 0) + 1;
    if (t.status === finalStageKey) byMember[key].done += 1;
  }

  const completionRate = total === 0 ? 0 : Math.round(((counts[finalStageKey] ?? 0) / total) * 100);

  // Urutkan: paling banyak tugas dulu, "Belum ditentukan" selalu di akhir.
  const memberRows = Object.entries(byMember).sort(([keyA, a], [keyB, b]) => {
    if (keyA === "unassigned") return 1;
    if (keyB === "unassigned") return -1;
    return b.total - a.total;
  });

  const exportRows = tasks.map((t) => ({
    Judul: t.title,
    Kategori: t.tag,
    Status: STATUS_META[t.status]?.label ?? t.status,
    "Ditugaskan ke": t.assignee,
    Tenggat: t.due,
  }));

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-bold">{labels.navReport}</h1>
        {!isSample && <ExportButton rows={exportRows} filename={`laporan-${labels.taskLabel.toLowerCase().replace(/[\s/]+/g, "-")}.csv`} />}
      </div>
      <p className="text-sm text-inkMuted mb-6">
        Ringkasan progres {labels.taskLabel.toLowerCase()} di seluruh {labels.teamLabel.toLowerCase()}.
        {isSample && " (menampilkan data contoh — belum ada data sungguhan)"}
      </p>

      {/* Ringkasan kartu */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={total} color="#16323C" />
        <StatCard label={workflowStages[0]?.label ?? "Tahap 1"} value={counts[workflowStages[0]?.key ?? "todo"] ?? 0} color={STATUS_META[workflowStages[0]?.key ?? "todo"]?.color ?? labels.accent} />
        <StatCard label={workflowStages[Math.min(1, workflowStages.length - 1)]?.label ?? "Tahap 2"} value={counts[workflowStages[Math.min(1, workflowStages.length - 1)]?.key ?? "doing"] ?? 0} color={STATUS_META[workflowStages[Math.min(1, workflowStages.length - 1)]?.key ?? "doing"]?.color ?? labels.accent} />
        <StatCard label={workflowStages[workflowStages.length - 1]?.label ?? "Selesai"} value={counts[finalStageKey] ?? 0} color={STATUS_META[finalStageKey]?.color ?? labels.accent} />
      </div>

      {/* Progress bar keseluruhan */}
      <div className="bg-surface border border-border rounded-card p-5 mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold">Tingkat Penyelesaian</span>
          <span className="text-sm font-bold">{completionRate}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-surfaceAlt overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${completionRate}%`, backgroundColor: STATUS_META[finalStageKey]?.color ?? labels.accent }}
          />
        </div>
      </div>

      {/* Kinerja per anggota */}
      <div className="bg-surface border border-border rounded-card p-5 mb-8">
        <h2 className="text-sm font-semibold mb-4">Kinerja per Anggota</h2>
        <div className="space-y-4">
          {memberRows.map(([key, stat]) => {
            const pct = stat.total === 0 ? 0 : Math.round((stat.done / stat.total) * 100);
            return (
              <div key={key}>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-medium">{stat.name}</span>
                  <span className="text-inkMuted">
                    {stat.done}/{stat.total} selesai
                    {Object.entries(stat.statusCounts).filter(([k]) => k !== finalStageKey && stat.statusCounts[k] > 0).map(([k,v]) => ` · ${v} ${STATUS_META[k]?.label ?? k}`).join("")}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surfaceAlt overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: labels.accent }} />
                </div>
              </div>
            );
          })}
          {memberRows.length === 0 && <p className="text-sm text-inkMuted">Belum ada data untuk ditampilkan.</p>}
        </div>
      </div>

      {/* Breakdown per kategori/tag */}
      <div className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-sm font-semibold mb-4">Rincian per Kategori</h2>
        <div className="space-y-4">
          {Object.entries(byTag).map(([tag, stat]) => {
            const pct = stat.total === 0 ? 0 : Math.round((stat.done / stat.total) * 100);
            return (
              <div key={tag}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium">{tag}</span>
                  <span className="text-inkMuted">
                    {stat.done}/{stat.total} selesai
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surfaceAlt overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: labels.accent }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(byTag).length === 0 && (
            <p className="text-sm text-inkMuted">Belum ada data untuk ditampilkan.</p>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-card p-4">
      <div className="text-2xl font-bold mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-inkMuted">{label}</div>
    </div>
  );
}
