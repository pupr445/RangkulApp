import { fetchActivityLog, type ActivityLogEntry } from "@/lib/data/activity-log";

export interface LeaderDashboardData {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  members: number;
  completionRate: number;
  recentActivities: ActivityLogEntry[];
}

export async function fetchLeaderDashboard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  organizationId: string,
  finalStageKey: string
): Promise<LeaderDashboardData> {
  const [{ data: tasks }, { count: members }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, status, due_date")
      .eq("organization_id", organizationId),
    supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  const rows = (tasks ?? []) as Array<{ status: string; due_date: string | null }>;
  const today = new Date().toISOString().slice(0, 10);
  const total = rows.length;
  const completed = rows.filter((row) => row.status === finalStageKey).length;
  const overdue = rows.filter(
    (row) => row.due_date && row.due_date < today && row.status !== finalStageKey
  ).length;
  const dueToday = rows.filter(
    (row) => row.due_date === today && row.status !== finalStageKey
  ).length;

  return {
    total,
    completed,
    overdue,
    dueToday,
    members: members ?? 0,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    recentActivities: await fetchActivityLog(supabase, organizationId, { limit: 8 }),
  };
}
