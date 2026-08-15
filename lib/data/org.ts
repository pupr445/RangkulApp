import { createClient } from "@/lib/supabase/server";
import { SectorKey } from "@/lib/labels/sectors";
import { OrgRole } from "@/lib/labels/LabelProvider";
import { notifyUser } from "@/lib/data/notifications";

export interface OrgRow {
  id: string;
  name: string;
  sector_type: SectorKey;
  label_overrides: Record<string, string> | null;
  workflow_stages: unknown;
}

/**
 * Helper dipakai di semua Server Component halaman dashboard.
 * Mengembalikan organisasi milik/tempat user yang sedang login bergabung,
 * beserta instance Supabase client (server-side) yang sudah terikat sesi
 * user tsb, supaya query-query berikutnya otomatis tunduk pada RLS. Juga
 * mengembalikan `role` user tsb di organisasi ("owner" | "manager" |
 * "member") — dipakai UI untuk menyembunyikan aksi yang tidak diizinkan
 * (lihat lib/labels/LabelProvider.tsx: useCanManage()).
 *
 * Urutan resolusi organisasi:
 * 1. User adalah owner organisasi (kolom organizations.owner_id).
 * 2. User sudah tercatat sebagai anggota (organization_members).
 * 3. Ada undangan (invitations) yang cocok dengan email user ini —
 *    jika ketemu, user OTOMATIS didaftarkan sebagai anggota (lihat
 *    supabase/migrations/003_team_members.sql untuk RLS yang mengizinkan
 *    user baru bergabung sendiri lewat undangan).
 * 4. Tidak ketemu apapun -> return org: null (halaman pemanggil akan
 *    redirect ke /onboarding).
 */
export async function getCurrentOrg() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, org: null as OrgRow | null, role: "member" as OrgRole };
  }

  // 1. Owner
  const { data: ownedOrg } = await supabase
    .from("organizations")
    .select("id, name, sector_type, label_overrides, workflow_stages")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownedOrg) {
    return { supabase, user, org: ownedOrg as OrgRow, role: "owner" as OrgRole };
  }

  // 2. Sudah jadi anggota organisasi lain
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    const m = membership as { organization_id: string; role: string };
    const { data: memberOrg } = await supabase
      .from("organizations")
      .select("id, name, sector_type, label_overrides, workflow_stages")
      .eq("id", m.organization_id)
      .maybeSingle();
    if (memberOrg) {
      return {
        supabase,
        user,
        org: memberOrg as OrgRow,
        role: (m.role === "manager" ? "manager" : "member") as OrgRole,
      };
    }
  }

  // 3. Ada undangan yang cocok dengan email user ini -> auto-join
  const email = user.email;
  if (email) {
    const { data: invite } = await supabase
      .from("invitations")
      .select("organization_id, role, invited_by")
      .eq("email", email)
      .eq("accepted", false)
      .maybeSingle();

    if (invite) {
      const inv = invite as { organization_id: string; role: string; invited_by: string | null };

      await supabase.from("organization_members").insert([
        {
          organization_id: inv.organization_id,
          user_id: user.id,
          role: inv.role,
          full_name:
            (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0],
        },
      ]);
      await supabase
        .from("invitations")
        .update({ accepted: true })
        .eq("organization_id", inv.organization_id)
        .eq("email", email);

      const { data: joinedOrg } = await supabase
        .from("organizations")
        .select("id, name, sector_type, label_overrides, workflow_stages")
        .eq("id", inv.organization_id)
        .maybeSingle();

      // Beri tahu yang mengundang bahwa undangannya sudah diterima —
      // supaya manager tahu anggotanya sudah aktif tanpa perlu cek manual.
      if (inv.invited_by) {
        const joinedName =
          (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
        notifyUser(supabase, {
          organizationId: inv.organization_id,
          recipientId: inv.invited_by,
          actorId: user.id,
          actorName: joinedName,
          type: "invitation",
          content: `${joinedName} menerima undangan dan bergabung ke organisasi.`,
          link: "/dashboard/settings",
        });
      }

      if (joinedOrg) {
        return {
          supabase,
          user,
          org: joinedOrg as OrgRow,
          role: (inv.role === "manager" ? "manager" : "member") as OrgRole,
        };
      }
    }
  }

  return { supabase, user, org: null as OrgRow | null, role: "member" as OrgRole };
}
