import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * POST /api/audit-log
 * Body: { organizationId, actorId, actorName, action, targetType?, targetId?, targetLabel?, teamId?, detail? }
 *
 * Menulis satu baris ke `security_audit_logs` lewat SERVICE ROLE (melewati
 * RLS "hanya manager boleh insert"), supaya penulisan audit trail tidak
 * bergantung pada sesi/izin pemanggil di sisi client dan tidak bisa gagal
 * diam-diam kalau ternyata pemanggil bukan manager saat insert terjadi.
 *
 * Sebagai gantinya, endpoint ini SENDIRI yang memverifikasi:
 *   1. Ada sesi login yang valid (lewat cookie, cek server-side).
 *   2. User yang login benar-benar anggota organisasi yang dimaksud.
 * Kalau salah satu gagal, insert ditolak dengan error yang jelas — bukan
 * dicatat diam-diam sebagai kegagalan di console browser.
 */
export async function POST(request: Request) {
  let body: {
    organizationId?: string;
    actorId?: string;
    actorName?: string;
    action?: string;
    targetType?: string | null;
    targetId?: string | null;
    targetLabel?: string | null;
    teamId?: string | null;
    detail?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid (bukan JSON)." }, { status: 400 });
  }

  const { organizationId, actorId, actorName, action } = body;
  if (!organizationId || !actorId || !actorName || !action) {
    return NextResponse.json(
      { error: "organizationId, actorId, actorName, dan action wajib diisi." },
      { status: 400 }
    );
  }

  // 1. Pastikan ada sesi login yang valid.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sesi tidak valid atau sudah berakhir." }, { status: 401 });
  }

  // 2. Pastikan user yang login benar-benar anggota organisasi ini.
  //    (Query ini tetap tunduk pada RLS is_org_member — cukup untuk membuktikan keanggotaan.)
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: org } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", organizationId)
    .maybeSingle();

  const isMember = Boolean(membership) || org?.owner_id === user.id;
  if (membershipError || !isMember) {
    return NextResponse.json(
      { error: "Anda bukan anggota organisasi ini, audit log ditolak." },
      { status: 403 }
    );
  }

  // 3. Tulis baris audit lewat service role (melewati RLS insert "manager only")
  //    supaya penulisan tidak gagal diam-diam kalau role berubah di tengah alur.
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("security_audit_logs").insert([
    {
      organization_id: organizationId,
      actor_id: actorId,
      actor_name: actorName,
      action,
      target_type: body.targetType ?? null,
      target_id: body.targetId ?? null,
      target_label: body.targetLabel ?? null,
      team_id: body.teamId ?? null,
      detail: body.detail ?? null,
    },
  ]);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
