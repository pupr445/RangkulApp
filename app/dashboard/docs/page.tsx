import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { DocsManager } from "@/components/DocsManager";

export const runtime = "edge";

export default async function DocsPage() {
  const { user, org } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  return <DocsManager organizationId={org.id} />;
}
