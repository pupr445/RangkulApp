import { getCurrentOrg } from "@/lib/data/org";
import { fetchActivityLog } from "@/lib/data/activity-log";
import { ActivityLogView } from "@/components/ActivityLogView";

export const runtime = "edge";

export default async function ActivityLogPage() {
  const { supabase, org } = await getCurrentOrg();

  const entries = org ? await fetchActivityLog(supabase, org.id, { limit: 150 }) : [];

  return <ActivityLogView entries={entries} isSample={!org} />;
}
