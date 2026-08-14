import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyFieldKey } from "@/lib/data/custom-fields";

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

  // Template Preset per Sektor: buatkan tim & field data default kalau tersedia.
  // Kedua insert di bawah ini SENGAJA tidak menggagalkan pembuatan organisasi
  // kalau errornya di sini (organisasi tetap berguna tanpa template) — tapi
  // errornya tetap dikumpulkan supaya admin diberi tahu, bukan didiamkan.
  // Skenario nyata yang bisa terjadi: migration 009_custom_field_builder.sql
  // belum dijalankan di database ini, sehingga insert custom_fields gagal
  // karena kolom field_options/is_required belum ada.
  const warnings: string[] = [];

  const { data: template } = await admin
    .from("sector_templates")
    .select("default_structure")
    .eq("sector_type", sectorType)
    .limit(1)
    .maybeSingle();

  const structure = template?.default_structure as
    | {
        teams?: string[];
        custom_fields?: Array<{
          field_label: string;
          field_type: "text" | "number" | "date" | "select";
          field_options?: string[];
          is_required?: boolean;
        }>;
        workflow_stages?: Array<{ key: string; label: string }>
      }
    | null
    | undefined;

  const workflowStages = structure?.workflow_stages ?? [];
  if (workflowStages.length >= 2) {
    const { error: workflowError } = await admin.from("organizations").update({ workflow_stages: workflowStages }).eq("id", newOrg.id);
    if (workflowError) warnings.push(`Workflow bawaan sektor gagal disimpan (${workflowError.message}).`);
  }

  const teamNames = structure?.teams ?? [];
  if (teamNames.length > 0) {
    const { error: teamsError } = await admin
      .from("teams")
      .insert(teamNames.map((teamName) => ({ organization_id: newOrg.id, name: teamName })));
    if (teamsError) {
      warnings.push(`Tim bawaan sektor gagal dibuat otomatis (${teamsError.message}).`);
    }
  }

  const templateFields = structure?.custom_fields ?? [];
  if (templateFields.length > 0) {
    const { error: fieldsError } = await admin.from("custom_fields").insert(
      templateFields.map((f) => ({
        organization_id: newOrg.id,
        entity: "task",
        field_key: slugifyFieldKey(f.field_label),
        field_label: f.field_label,
        field_type: f.field_type,
        field_options: f.field_options ?? null,
        is_required: f.is_required ?? false,
      }))
    );
    if (fieldsError) {
      warnings.push(
        `Field data bawaan sektor gagal dibuat otomatis (${fieldsError.message}). Kemungkinan migration 009_custom_field_builder.sql belum dijalankan.`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    organizationId: newOrg.id,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  });
}
