import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { fetchTaskCustomFields } from "@/lib/data/custom-fields";
import { fetchTeams } from "@/lib/data/teams";
import { SettingsForm } from "@/components/SettingsForm";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { TeamsManager } from "@/components/TeamsManager";
import { LabelOverridesManager } from "@/components/LabelOverridesManager";

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
      {/* Nama organisasi, sektor, dan istilah manual mengubah identitas
          organisasi secara keseluruhan — dibatasi ke Owner saja (sejalan
          dengan RLS "org_update_owner" pada tabel organizations, yang
          tidak diubah oleh migration 006). Manager tetap bisa kelola
          operasional sehari-hari (tim, custom field) di bawah. */}
      {role === "owner" ? (
        <>
          <SettingsForm organizationId={org.id} currentName={org.name} currentSector={org.sector_type} />
          <LabelOverridesManager organizationId={org.id} currentOverrides={org.label_overrides} />
        </>
      ) : (
        <div className="bg-surfaceAlt border border-border rounded-card p-4 mb-6">
          <p className="text-sm text-inkMuted">
            Nama organisasi, sektor, dan istilah manual hanya bisa diubah oleh Owner. Kamu tetap bisa kelola{" "}
            {org.sector_type ? "tim dan field tambahan" : "pengaturan lain"} di bawah.
          </p>
        </div>
      )}
      <TeamsManager organizationId={org.id} teams={teams} />
      <CustomFieldsManager organizationId={org.id} fields={customFields} />
    </main>
  );
}
