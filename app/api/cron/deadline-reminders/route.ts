import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/deadline-reminders
 * Dipanggil oleh Cloudflare Cron Trigger (lihat wrangler.deadline-reminder.toml)
 * setiap jam. Menangani DUA aturan notifikasi sekaligus (Fase 5 roadmap):
 *   1. Deadline — pengingat H-1 & hari-H untuk tugas yang belum selesai.
 *   2. Overdue  — pengingat berulang tiap 3 hari untuk tugas yang SUDAH
 *      lewat tenggat dan masih belum di stage final, supaya tidak
 *      terlupakan tapi juga tidak membanjiri inbox tiap jam.
 * Keduanya idempotent lewat kolom dedupe_key — aman dipanggil berkali-kali.
 */
export const runtime = "edge";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function periodBucket(date: Date, everyDays: number): number {
  const epochDays = Math.floor(date.getTime() / 86_400_000);
  return Math.floor(epochDays / everyDays);
}

function resolveFinalStageKey(workflowStages: unknown): string | null {
  if (!Array.isArray(workflowStages) || workflowStages.length === 0) return null;
  const stages = workflowStages as Array<{ key?: unknown; final?: unknown }>;
  const finalStage = stages.find((s) => s.final === true) ?? stages[stages.length - 1];
  return typeof finalStage?.key === "string" ? finalStage.key : null;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi." }, { status: 503 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const todayKey = dateOnly(now);
  const tomorrowKey = dateOnly(addDays(now, 1));

  const { data: tasks, error: taskError } = await admin
    .from("tasks")
    .select("id, organization_id, title, due_date, status, assignee_id")
    .not("assignee_id", "is", null)
    .not("due_date", "is", null);

  if (taskError) return NextResponse.json({ ok: false, error: taskError.message }, { status: 500 });

  const allTasks = (tasks ?? []) as Array<{
    id: string;
    organization_id: string;
    title: string;
    due_date: string;
    status: string;
    assignee_id: string;
  }>;

  // --- Bagian 1: pengingat H-1 / hari-H (deadline) ---
  const deadlineCandidates = allTasks
    .filter((task) => task.due_date === todayKey || task.due_date === tomorrowKey)
    .map((task) => {
      const isToday = task.due_date === todayKey;
      return {
        organizationId: task.organization_id,
        title: task.title,
        recipientId: task.assignee_id,
        type: "deadline" as const,
        content: isToday ? `Tugas "${task.title}" jatuh tempo hari ini.` : `Tugas "${task.title}" akan jatuh tempo besok.`,
        dedupeKey: `deadline:${task.id}:${task.due_date}:${task.assignee_id}`,
        entityId: task.id,
      };
    });

  // --- Bagian 2: pengingat OVERDUE (sudah lewat tenggat & belum selesai) ---
  // Dikirim ulang setiap 3 hari selama tugas masih belum di stage final —
  // supaya tidak spam harian, tapi tetap terasa kalau dibiarkan lama.
  const orgIds = Array.from(new Set(allTasks.map((t) => t.organization_id)));
  const { data: orgs, error: orgError } = await admin
    .from("organizations")
    .select("id, workflow_stages")
    .in("id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]);
  if (orgError) return NextResponse.json({ ok: false, error: orgError.message }, { status: 500 });

  const finalStageByOrg = new Map<string, string | null>(
    (orgs ?? []).map((o) => [String(o.id), resolveFinalStageKey(o.workflow_stages)])
  );
  const bucket = periodBucket(now, 3);

  const overdueCandidates = allTasks
    .filter((task) => {
      const finalKey = finalStageByOrg.get(task.organization_id);
      const isDone = finalKey !== null && finalKey !== undefined && task.status === finalKey;
      return !isDone && task.due_date < todayKey;
    })
    .map((task) => ({
      organizationId: task.organization_id,
      title: task.title,
      recipientId: task.assignee_id,
      type: "overdue" as const,
      content: `Tugas "${task.title}" sudah melewati tenggat (${task.due_date}) dan belum selesai.`,
      dedupeKey: `overdue:${task.id}:${task.assignee_id}:${bucket}`,
      entityId: task.id,
    }));

  const candidates = [...deadlineCandidates, ...overdueCandidates];
  if (!candidates.length) return NextResponse.json({ ok: true, created: 0, skipped: 0 });

  const { data: existing, error: existingError } = await admin
    .from("notifications")
    .select("dedupe_key")
    .in("dedupe_key", candidates.map((item) => item.dedupeKey));

  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });

  const existingKeys = new Set((existing ?? []).map((row) => row.dedupe_key).filter(Boolean));
  const rows = candidates
    .filter((item) => !existingKeys.has(item.dedupeKey))
    .map((item) => ({
      organization_id: item.organizationId,
      user_id: item.recipientId,
      actor_id: null,
      actor_name: "RANGKUL",
      type: item.type,
      content: item.content,
      link: "/dashboard/tasks",
      is_read: false,
      entity_type: "task",
      entity_id: item.entityId,
      dedupe_key: item.dedupeKey,
    }));

  if (!rows.length) return NextResponse.json({ ok: true, created: 0, skipped: candidates.length });

  const { error: insertError } = await admin.from("notifications").insert(rows);
  if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    created: rows.length,
    skipped: candidates.length - rows.length,
    evaluated: candidates.length,
    deadlineCount: deadlineCandidates.length,
    overdueCount: overdueCandidates.length,
  });
}
