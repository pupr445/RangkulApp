import { getCurrentOrg } from "@/lib/data/org";
import { getLabels } from "@/lib/labels/sectors";
import { sampleColumnsFor, BoardColumn } from "@/lib/data/sample-tasks";
import { fetchMemberOptions, initialsFromName } from "@/lib/data/members";
import { fetchTaskCustomFields } from "@/lib/data/custom-fields";
import { Board } from "@/components/Board";

export const runtime = "edge";

export default async function DashboardPage() {
  const { supabase, user, org } = await getCurrentOrg();

  const sector = org?.sector_type ?? "lainnya";
  const labels = getLabels(sector, org?.label_overrides ?? null);

  // Coba ambil tugas sungguhan dari database. Jika organisasi belum
  // punya data (baru saja onboarding), tampilkan contoh per sektor
  // supaya dashboard tidak terlihat kosong.
  let columns: BoardColumn[] = sampleColumnsFor(sector);
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

  if (org) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, tag, due_date, assignee_id, custom_data")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

    if (tasks && tasks.length > 0) {
      isSample = false;
      const grouped: Record<string, BoardColumn> = {
        todo: { id: "todo", name: "Belum Dikerjakan", cards: [] },
        doing: { id: "doing", name: "Sedang Dikerjakan", cards: [] },
        done: { id: "done", name: "Selesai", cards: [] },
      };
      for (const t of tasks as Array<Record<string, unknown>>) {
        const status = (t.status as string) ?? "todo";
        const bucket = grouped[status] ?? grouped.todo;
        const assigneeId = (t.assignee_id as string | null) ?? undefined;
        const assigneeName = assigneeId ? memberMap.get(assigneeId) ?? "Anggota" : "Belum ditentukan";
        bucket.cards.push({
          id: String(t.id),
          tag: (t.tag as string) ?? "Umum",
          title: t.title as string,
          assignee: assigneeName,
          assigneeInitials: assigneeId ? initialsFromName(assigneeName) : "—",
          assigneeId,
          due: (t.due_date as string) ?? "-",
          customData: (t.custom_data as Record<string, string> | null) ?? {},
        });
      }
      columns = Object.values(grouped);
    }
  }

  return (
    <Board
      title={labels.boardTitleExample}
      subtitle={labels.boardSubtitleExample}
      columns={columns}
      organizationId={org?.id}
      isSample={isSample}
      members={members}
      customFields={customFields}
    />
  );
}
