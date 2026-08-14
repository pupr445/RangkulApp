import { describeActivity, type ActivityLogEntry } from "@/lib/data/activity-log";

export interface LeaderSummaryData {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  members: number;
  completionRate: number;
  recentActivities: ActivityLogEntry[];
}

export function LeaderSummary({ data }: { data: LeaderSummaryData }) {
  const cards = [
    { label: "Total tugas", value: data.total },
    { label: "Selesai", value: data.completed },
    { label: "Terlambat", value: data.overdue },
    { label: "Jatuh tempo hari ini", value: data.dueToday },
    { label: "Anggota", value: data.members },
    { label: "Penyelesaian", value: `${data.completionRate}%` },
  ];

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold">Ringkasan Pimpinan</h2>
          <p className="text-xs text-inkMuted mt-0.5">Snapshot pekerjaan organisasi saat ini.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-surface border border-border rounded-card p-4">
            <div className="text-xl font-bold mb-1">{card.value}</div>
            <div className="text-[11px] text-inkMuted leading-snug">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-card p-4">
        <div className="text-sm font-semibold mb-3">Aktivitas Terbaru</div>
        {data.recentActivities.length === 0 ? (
          <p className="text-xs text-inkMuted">Belum ada aktivitas tercatat.</p>
        ) : (
          <div className="space-y-2.5">
            {data.recentActivities.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2.5 text-xs">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
                <div className="min-w-0">
                  <div className="leading-snug">
                    <span className="font-semibold">{entry.actor_name ?? "Seseorang"}</span>{" "}
                    {describeActivity(entry)}
                  </div>
                  <div className="text-[10px] text-inkMuted mt-0.5">
                    {new Date(entry.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
