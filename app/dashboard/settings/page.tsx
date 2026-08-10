import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { fetchTaskCustomFields } from "@/lib/data/custom-fields";
import { SettingsForm } from "@/components/SettingsForm";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";

export const runtime = "edge";

export default async function SettingsPage() {
  const { supabase, user, org } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  const customFields = await fetchTaskCustomFields(supabase, org.id);

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0 max-w-2xl">
      <SettingsForm organizationId={org.id} currentName={org.name} currentSector={org.sector_type} />
      <CustomFieldsManager organizationId={org.id} fields={customFields} />
    </main>
  );
}
