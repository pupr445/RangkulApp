import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFinalStageKey } from "@/lib/data/workflow-final-stage";

/**
 * GET /api/cron/daily-summary?period=daily|weekly
 * Dipanggil oleh dua Cloudflare Worker terpisah (rangkul-daily-summary
 * jalan tiap hari, rangkul-weekly-summary jalan tiap Senin) — satu
 * endpoint, dibedakan lewat query param `period`, supaya logikanya
 * tidak perlu ditulis dua kali (Fase 15 Master Roadmap).
 *
 * Untuk setiap organisasi yang punya minimal satu task, kirim SATU
 * notifikasi ringkasan ke Owner + Manager organisasi itu (bukan ke
 * semua anggota — ini laporan level pemimpin, sama seperti Leader
 * Dashboard). Organisasi tanpa task dilewati, tidak ada yang perlu
 * dilaporkan.
 *
 * CATATAN SCOPE: ringkasan ini adalah SNAPSHOT kondisi saat ini (total,
 * selesai, terlambat, jatuh tempo hari ini) — BUKAN delta "apa yang
 * berubah sejak kemarin", karena tabel tasks belum punya kolom
 * updated_at/completed_at untuk melacak itu secara akurat. Delta yang
 * lebih detail bisa jadi peningkatan terpisah nanti.
 */
export const runtime = "edge";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekBucket(d: Date): number {
  const epochDays = Math.floor(d.getTime() / 86_400_000);
  return Math.floor(epochDays / 7);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi." }, { status: 503 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period") === "weekly" ? "weekly" : "daily";

  const admin = createAdminClient();
  const now = new Date();
  const todayKey = dateOnly(now);
  const periodKey = period === "weekly" ? `w${weekBucket(now)}` : todayKey;

  const { data: orgs, error: orgError } = await admin
    .from("organizations")
    .select("id, name, owner_id, workflow_stages");
  if (orgError) return NextResponse.json({ ok: false, error: orgError.message }, { status: 500 });

  let created = 0;
  let skipped = 0;
  let orgsWithData = 0;

  for (const org of orgs ?? []) {
    const orgId = String(org.id);

    const { data: tasks } = await admin
      .from("tasks")
      .select("status, due_date")
      .eq("organization_id", orgId);

    const rows = (tasks ?? []) as Array<{ status: string; due_date: string | null }>;
    if (rows.length === 0) continue; // tidak ada yang perlu dilaporkan

    orgsWithData += 1;
    const finalStageKey = resolveFinalStageKey(org.workflow_stages);
    const total = rows.length;
    const completed = finalStageKey ? rows.filter((r) => r.status === finalStageKey).length : 0;
    const overdue = rows.filter((r) => r.due_date && r.due_date < todayKey && r.status !== finalStageKey).length;
    const dueToday = rows.filter((r) => r.due_date === todayKey && r.status !== finalStageKey).length;

    const { data: managers } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("role", "manager");

    const recipientIds = new Set<string>((managers ?? []).map((m) => String(m.user_id)));
    if (org.owner_id) recipientIds.add(String(org.owner_id));
    if (recipientIds.size === 0) continue;

    const label = period === "weekly" ? "minggu ini" : "hari ini";
    const content =
      `Ringkasan ${label} — ${org.name}: ${total} task aktif, ${completed} selesai, ` +
      `${overdue} terlambat, ${dueToday} jatuh tempo hari ini.`;

    const candidates = Array.from(recipientIds).map((userId) => ({
      user_id: userId,
      dedupe_key: `summary:${period}:${orgId}:${userId}:${periodKey}`,
    }));

    const { data: existing } = await admin
      .from("notifications")
      .select("dedupe_key")
      .in("dedupe_key", candidates.map((c) => c.dedupe_key));
    const existingKeys = new Set((existing ?? []).map((r) => r.dedupe_key).filter(Boolean));

    const rowsToInsert = candidates
      .filter((c) => !existingKeys.has(c.dedupe_key))
      .map((c) => ({
        organization_id: orgId,
        user_id: c.user_id,
        actor_id: null,
        actor_name: "RANGKUL",
        type: "summary",
        content,
        link: "/dashboard",
        is_read: false,
        entity_type: "organization",
        entity_id: orgId,
        dedupe_key: c.dedupe_key,
      }));

    skipped += candidates.length - rowsToInsert.length;
    if (rowsToInsert.length === 0) continue;

    const { error: insertError } = await admin.from("notifications").insert(rowsToInsert);
    if (!insertError) created += rowsToInsert.length;
  }

  return NextResponse.json({ ok: true, period, organizationsEvaluated: (orgs ?? []).length, organizationsWithData: orgsWithData, created, skipped });
}
