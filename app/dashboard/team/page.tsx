import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { TeamManager, MemberRow, InviteRow } from "@/components/TeamManager";

export const runtime = "edge";

export default async function TeamPage() {
  const { supabase, user, org, role, sectorPosition } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  const { data: membersData } = await supabase
    .from("organization_members")
    .select("id:user_id, full_name, role, sector_position")
    .eq("organization_id", org.id);

  const { data: invitesData } = await supabase
    .from("invitations")
    .select("email, role, sector_position")
    .eq("organization_id", org.id)
    .eq("accepted", false);

  const memberRows = (membersData as MemberRow[] | null) ?? [];

  // Owner tidak selalu punya baris di organization_members (disimpan
  // lewat organizations.owner_id — lihat catatan di schema.sql). Entri
  // sintetis untuk Owner HANYA ditambahkan kalau viewer halaman ini
  // MEMANG owner-nya sendiri (role === "owner") — kalau ditambahkan
  // tanpa syarat, manager/member yang membuka halaman ini akan melihat
  // dirinya sendiri muncul DUA KALI dengan label "Owner" yang salah.
  const members: MemberRow[] =
    role === "owner" && !memberRows.some((m) => m.id === user.id)
      ? [
          {
            id: user.id,
            full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Kamu",
            role: "owner",
            sector_position: sectorPosition,
          },
          ...memberRows,
        ]
      : memberRows;

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
      currentUserId={user.id}
    />
  );
}
