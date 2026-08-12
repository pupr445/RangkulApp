import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * POST /api/create-organization
 * Body: { name: string, sectorType: string }
 *
 * Dibuat sebagai jalur alternatif dari insert langsung di browser (yang
 * sempat gagal terus-menerus karena anomali PostgREST/RLS di project
 * Supabase tertentu — lihat diskusi debugging di riwayat chat). Endpoint
 * ini pakai SERVICE ROLE KEY (lihat lib/supabase/admin.ts) yang melewati
 * RLS sepenuhnya, sehingga tidak bergantung pada auth.uid() client-side.
 *
 * Keamanannya tetap terjaga karena:
 * 1. User diverifikasi dulu lewat sesi cookie (createClient() server biasa).
 * 2. owner_id diisi dari user.id hasil verifikasi tsb, BUKAN dari body
 *    request — jadi tidak bisa dipalsukan jadi organisasi orang lain.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const sectorType = body?.sectorType as string | undefined;

  if (!name || !sectorType) {
    return NextResponse.json({ error: "Nama organisasi dan sektor wajib diisi." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Konfigurasi server belum lengkap." },
      { status: 500 }
    );
  }

  // Cegah satu akun membuat organisasi ganda (selain unique constraint di
  // database — lihat migration 007 — ini memberi pesan error yang lebih jelas).
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Kamu sudah punya organisasi lain." }, { status: 409 });
  }

  const { data: newOrg, error: insertError } = await admin
    .from("organizations")
    .insert([{ name, sector_type: sectorType, owner_id: user.id }])
    .select("id")
    .single();

  if (insertError || !newOrg) {
    return NextResponse.json(
      { error: insertError?.message ?? "Gagal membuat organisasi." },
      { status: 500 }
    );
  }

  // Template Preset per Sektor: buatkan tim default kalau tersedia.
  const { data: template } = await admin
    .from("sector_templates")
    .select("default_structure")
    .eq("sector_type", sectorType)
    .limit(1)
    .maybeSingle();

  const structure = template?.default_structure as { teams?: string[] } | null | undefined;
  const teamNames = structure?.teams ?? [];

  if (teamNames.length > 0) {
    await admin
      .from("teams")
      .insert(teamNames.map((teamName) => ({ organization_id: newOrg.id, name: teamName })));
  }

  return NextResponse.json({ ok: true, organizationId: newOrg.id });
}
