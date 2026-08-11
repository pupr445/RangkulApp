import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { fetchTaskCustomFields } from "@/lib/data/custom-fields";
import { fetchTeams } from "@/lib/data/teams";
import { SettingsForm } from "@/components/SettingsForm";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { TeamsManager } from "@/components/TeamsManager";

export const runtime = "edge";

export default async function SettingsPage() {
  const { supabase, user, org, role } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  // Member biasa tidak boleh mengubah pengaturan organisasi — dialihkan
  // ke dashboard. (Ini pelengkap UX; keamanan sesungguhnya ada di RLS.)
  if (role === "member") {
    redirect("/dashboard");
  }

  const customFields = await fetchTaskCustomFields(supabase, org.id);
  const teams = await fetchTeams(supabase, org.id);

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0 max-w-2xl">
      <SettingsForm organizationId={org.id} currentName={org.name} currentSector={org.sector_type} />
      <TeamsManager organizationId={org.id} teams={teams} />
      <CustomFieldsManager organizationId={org.id} fields={customFields} />
    </main>
  );
}
