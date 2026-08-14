import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi." }, { status: 503 });
  }

  const admin = createAdminClient();
  const todayKey = dateOnly(new Date());
  const tomorrowKey = dateOnly(addDays(new Date(), 1));

  const { data: tasks, error: taskError } = await admin
    .from("tasks")
    .select("id, organization_id, title, due_date, assignee_id")
    .in("due_date", [todayKey, tomorrowKey])
    .not("assignee_id", "is", null);

  if (taskError) return NextResponse.json({ ok: false, error: taskError.message }, { status: 500 });

  const candidates = (tasks ?? []).map((task) => {
    const dueDate = String(task.due_date);
    const isToday = dueDate === todayKey;
    return {
      id: String(task.id),
      organizationId: String(task.organization_id),
      title: String(task.title),
      recipientId: String(task.assignee_id),
      content: isToday ? `Tugas "${task.title}" jatuh tempo hari ini.` : `Tugas "${task.title}" akan jatuh tempo besok.`,
      dedupeKey: `deadline:${task.id}:${dueDate}:${task.assignee_id}`,
    };
  });

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
      type: "deadline",
      content: item.content,
      link: "/dashboard/tasks",
      is_read: false,
      entity_type: "task",
      entity_id: item.id,
      dedupe_key: item.dedupeKey,
    }));

  if (!rows.length) return NextResponse.json({ ok: true, created: 0, skipped: candidates.length });

  const { error: insertError } = await admin.from("notifications").insert(rows);
  if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true, created: rows.length, skipped: candidates.length - rows.length, evaluated: candidates.length, dueDates: [todayKey, tomorrowKey] });
}
