/**
 * Helper untuk mengambil daftar anggota yang bisa ditugaskan (assignee)
 * pada sebuah tugas. Dipakai baik dari Server Component (dashboard/tasks
 * page, dengan currentUser yang sudah diketahui) maupun dari Client
 * Component (modal, tanpa currentUser -> fungsi ini akan memanggil
 * supabase.auth.getUser() sendiri).
 *
 * Owner organisasi selalu disertakan di daftar (karena owner tidak selalu
 * punya baris di organization_members — lihat catatan di schema.sql).
 */

export interface MemberOption {
  id: string;
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchMemberOptions(
  supabase: any,
  organizationId: string,
  currentUser?: { id: string; name: string } | null
): Promise<MemberOption[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, full_name")
    .eq("organization_id", organizationId);

  const list: MemberOption[] = ((data as Array<{ user_id: string; full_name: string | null }>) ?? []).map(
    (m) => ({ id: m.user_id, name: m.full_name ?? "Tanpa nama" })
  );

  let owner = currentUser ?? null;
  if (!owner) {
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    if (u) {
      owner = {
        id: u.id,
        name: (u.user_metadata?.full_name as string | undefined) ?? u.email?.split("@")[0] ?? "Saya",
      };
    }
  }

  if (owner && !list.some((m) => m.id === owner!.id)) {
    list.unshift(owner);
  }

  return list;
}

export function initialsFromName(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
