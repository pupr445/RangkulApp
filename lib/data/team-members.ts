/**
 * Data layer untuk keanggotaan tim (team_members) — lihat
 * supabase/migrations/011_team_membership.sql. Owner/Manager organisasi
 * selalu dianggap "punya akses" ke semua tim lewat is_org_manager() di
 * RLS, jadi TIDAK perlu baris team_members eksplisit untuk mereka.
 */

export interface TeamMemberRow {
  team_id: string;
  user_id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTeamMembersByOrg(
  supabase: any,
  organizationId: string
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, user_id")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("fetchTeamMembersByOrg gagal:", error.message);
    return {};
  }

  const map: Record<string, string[]> = {};
  for (const row of (data as TeamMemberRow[] | null) ?? []) {
    (map[row.team_id] ??= []).push(row.user_id);
  }
  return map;
}

/** Daftar team_id yang diikuti satu user tertentu di organisasi ini. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUserTeamIds(supabase: any, organizationId: string, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    console.error("fetchUserTeamIds gagal:", error.message);
    return [];
  }
  return ((data as { team_id: string }[] | null) ?? []).map((r) => r.team_id);
}
