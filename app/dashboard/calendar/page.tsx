import { getCurrentOrg } from "@/lib/data/org";
import { sampleFlatTasksFor, FlatTask } from "@/lib/data/flat-tasks";
import { fetchMemberOptions } from "@/lib/data/members";
import { fetchTaskCustomFields } from "@/lib/data/custom-fields";
import { fetchTeams } from "@/lib/data/teams";
import { CalendarView } from "@/components/CalendarView";

export const runtime = "edge";

export default async function CalendarPage() {
  const { supabase, user, org } = await getCurrentOrg();
  const sector = org?.sector_type ?? "lainnya";

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
  const customFields = org ? await fetchTaskCustomFields(supabase, org.id) : [];
  const teams = org ? await fetchTeams(supabase, org.id) : [];

  if (org) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, tag, due_date, assignee_id, team_id, custom_data")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

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
          teamId: (t.team_id as string | null) ?? undefined,
          customData: (t.custom_data as Record<string, string> | null) ?? {},
        };
      });
    }
  }

  return (
    <CalendarView
      tasks={tasks}
      organizationId={org?.id}
      isSample={isSample}
      members={members}
      customFields={customFields}
      teams={teams}
    />
  );
}
