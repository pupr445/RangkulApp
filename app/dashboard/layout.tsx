import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { LabelProvider } from "@/lib/labels/LabelProvider";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { normalizeWorkflowStages } from "@/lib/data/workflows";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, role } = await getCurrentOrg();

  if (!user) {
    redirect("/login");
  }

  if (!org) {
    redirect("/onboarding");
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Pengguna";

  return (
    <LabelProvider sector={org.sector_type} overrides={org.label_overrides} workflowStages={normalizeWorkflowStages(org.workflow_stages, org.sector_type)} role={role} userId={user.id}>
      <div className="min-h-screen flex flex-col">
        <TopBar userName={displayName} organizationId={org.id} />
        <div className="flex flex-1">
          <Sidebar />
          {children}
        </div>
      </div>
    </LabelProvider>
  );
}

