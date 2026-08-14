import { getCurrentOrg } from "@/lib/data/org";
import { fetchActivityLog, fetchSecurityAuditLog } from "@/lib/data/activity-log";
import { ActivityLogView } from "@/components/ActivityLogView";

export const runtime = "edge";

export default async function ActivityLogPage() {
  const { supabase, org, role } = await getCurrentOrg();

  if (!org) {
    return <ActivityLogView entries={[]} auditEntries={[]} teams={[]} members={[]} canAudit={false} isSample />;
  }

  const [{ data: teamRows }, { data: memberRows }, entries, auditEntries] = await Promise.all([
    supabase.from("teams").select("id, name").eq("organization_id", org.id).order("name"),
    supabase.from("organization_members").select("user_id, full_name").eq("organization_id", org.id).order("full_name"),
    fetchActivityLog(supabase, org.id, { limit: 500 }),
    role === "owner" || role === "manager" ? fetchSecurityAuditLog(supabase, org.id, { limit: 300 }) : Promise.resolve([]),
  ]);

  const members = ((memberRows ?? []) as Array<{ user_id: string; full_name: string | null }>).map((m) => ({
    id: m.user_id,
    name: m.full_name,
  }));

  return (
    <ActivityLogView
      entries={entries}
      auditEntries={auditEntries}
      teams={(teamRows ?? []) as { id: string; name: string }[]}
      members={members}
      canAudit={role === "owner" || role === "manager"}
    />
  );
}
