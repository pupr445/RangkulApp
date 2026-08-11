/**
 * Struktur Tim Majemuk
 * ---------------------
 * Satu organisasi bisa punya banyak tim/kelas/poli (tabel `teams`,
 * sudah ada sejak schema.sql). Helper ini dipakai untuk mengisi dropdown
 * pemilihan tim di form tugas, filter papan kerja, dan halaman
 * pengelolaan tim di Pengaturan.
 */

export interface TeamOption {
  id: string;
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTeams(supabase: any, organizationId: string): Promise<TeamOption[]> {
  const { data } = await supabase
    .from("teams")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  return (data as TeamOption[] | null) ?? [];
}
