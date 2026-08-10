import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { TeamManager, MemberRow, InviteRow } from "@/components/TeamManager";

export const runtime = "edge";

export default async function TeamPage() {
  const { supabase, user, org } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  const { data: membersData } = await supabase
    .from("organization_members")
    .select("id, full_name, role")
    .eq("organization_id", org.id);

  const { data: invitesData } = await supabase
    .from("invitations")
    .select("email, role")
    .eq("organization_id", org.id)
    .eq("accepted", false);

  const members: MemberRow[] = [
    // Owner selalu ditampilkan di urutan pertama meskipun tidak ada baris
    // di organization_members (owner disimpan lewat organizations.owner_id).
    {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Kamu",
      role: "owner",
    },
    ...((membersData as MemberRow[] | null) ?? []),
  ];

  const pendingInvites = (invitesData as InviteRow[] | null) ?? [];

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const appOrigin = `${proto}://${host}`;

  return (
    <TeamManager
      organizationId={org.id}
      ownerName={org.name}
      members={members}
      pendingInvites={pendingInvites}
      appOrigin={appOrigin}
    />
  );
}
