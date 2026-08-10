import { getCurrentOrg } from "@/lib/data/org";
import { sampleFlatTasksFor, FlatTask } from "@/lib/data/flat-tasks";
import { getLabels } from "@/lib/labels/sectors";

export const runtime = "edge";

const STATUS_META: Record<FlatTask["status"], { label: string; color: string }> = {
  todo: { label: "Belum Dikerjakan", color: "#C0562C" },
  doing: { label: "Sedang Dikerjakan", color: "#B8862F" },
  done: { label: "Selesai", color: "#2F9E7A" },
};

export default async function ReportsPage() {
  const { supabase, org } = await getCurrentOrg();
  const sector = org?.sector_type ?? "lainnya";
  const labels = getLabels(sector, org?.label_overrides ?? null);

  let tasks: FlatTask[] = sampleFlatTasksFor(sector);
  let isSample = true;

  if (org) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, tag, due_date")
      .eq("organization_id", org.id);

    if (data && data.length > 0) {
      isSample = false;
      tasks = (data as Array<Record<string, unknown>>).map((t) => ({
        id: String(t.id),
        title: t.title as string,
        tag: (t.tag as string) ?? "Umum",
        status: ((t.status as string) ?? "todo") as FlatTask["status"],
        due: (t.due_date as string) ?? "-",
        assignee: "—",
      }));
    }
  }

  const total = tasks.length;
  const counts: Record<FlatTask["status"], number> = { todo: 0, doing: 0, done: 0 };
  const byTag: Record<string, { total: number; done: number }> = {};

  for (const t of tasks) {
    counts[t.status] += 1;
    byTag[t.tag] ??= { total: 0, done: 0 };
    byTag[t.tag].total += 1;
    if (t.status === "done") byTag[t.tag].done += 1;
  }

  const completionRate = total === 0 ? 0 : Math.round((counts.done / total) * 100);

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <h1 className="text-2xl font-bold mb-1">{labels.navReport}</h1>
      <p className="text-sm text-inkMuted mb-6">
        Ringkasan progres {labels.taskLabel.toLowerCase()} di seluruh {labels.teamLabel.toLowerCase()}.
        {isSample && " (menampilkan data contoh — belum ada data sungguhan)"}
      </p>

      {/* Ringkasan kartu */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={total} color="#16323C" />
        <StatCard label={STATUS_META.todo.label} value={counts.todo} color={STATUS_META.todo.color} />
        <StatCard label={STATUS_META.doing.label} value={counts.doing} color={STATUS_META.doing.color} />
        <StatCard label={STATUS_META.done.label} value={counts.done} color={STATUS_META.done.color} />
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
            style={{ width: `${completionRate}%`, backgroundColor: STATUS_META.done.color }}
          />
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
