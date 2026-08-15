import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { NotificationPreferences } from "@/components/NotificationPreferences";

export const runtime = "edge";

export default async function NotificationPreferencesPage() {
  const { supabase, user, org } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  const { data: row } = await supabase
    .from("notification_email_prefs")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();

  const initialPrefs = (row?.prefs ?? {}) as Record<string, boolean>;

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0 max-w-2xl">
      <NotificationPreferences initialPrefs={initialPrefs} />
    </main>
  );
}
