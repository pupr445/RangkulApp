import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/data/notifications";

/**
 * GET /api/cron/notification-digest
 * Dipanggil oleh Cloudflare Cron Trigger setiap 15 menit (lihat
 * wrangler.notification-digest.toml). Mengirim SATU email ringkasan
 * (digest) per user — bukan satu email per notifikasi — supaya inbox
 * tidak banjir kalau ada banyak aktivitas dalam waktu singkat.
 *
 * Hanya mengirim untuk tipe notifikasi yang secara eksplisit diaktifkan
 * user lewat /dashboard/notifications/preferences (notification_email_prefs).
 * Default semua tipe OFF — user harus opt-in.
 *
 * Kolom notifications.emailed_at ditandai untuk SEMUA notifikasi yang
 * sudah dievaluasi worker ini, baik yang benar-benar terkirim email
 * maupun yang dilewati karena preferensi user mematikan tipe tsb —
 * supaya baris yang sama tidak dievaluasi berulang kali selamanya.
 */
export const runtime = "edge";

const TYPE_LABEL: Record<NotificationType, string> = {
  assignment: "Penugasan",
  mention: "Disebut",
  dm: "Pesan langsung",
  status_changed: "Perubahan status",
  deadline: "Deadline",
  overdue: "Terlambat",
  invitation: "Undangan diterima",
};

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi." }, { status: 503 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = (process.env.RANGKUL_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");

  const admin = createAdminClient();

  const { data: pending, error: pendingError } = await admin
    .from("notifications")
    .select("id, user_id, type, content, created_at")
    .is("emailed_at", null)
    .order("created_at", { ascending: true })
    .limit(500); // batas aman per run — sisanya otomatis kepick run berikutnya

  if (pendingError) return NextResponse.json({ ok: false, error: pendingError.message }, { status: 500 });
  if (!pending?.length) return NextResponse.json({ ok: true, usersProcessed: 0, emailsSent: 0, evaluated: 0 });

  const userIds = Array.from(new Set(pending.map((n) => String(n.user_id))));

  const { data: prefsRows } = await admin
    .from("notification_email_prefs")
    .select("user_id, prefs")
    .in("user_id", userIds);

  const prefsByUser = new Map<string, Record<string, boolean>>(
    (prefsRows ?? []).map((r) => [String(r.user_id), (r.prefs ?? {}) as Record<string, boolean>])
  );

  let emailsSent = 0;
  const processedIds: string[] = [];

  if (!resendApiKey || !fromEmail) {
    // Belum dikonfigurasi — tandai semua sebagai "sudah dievaluasi" supaya
    // tidak menumpuk, tapi jangan pura-pura terkirim. Ini sengaja jujur,
    // bukan diam-diam gagal seperti bug yang pernah kita perbaiki sebelumnya.
    for (const n of pending) processedIds.push(String(n.id));
    await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", processedIds);
    return NextResponse.json({
      ok: true,
      usersProcessed: 0,
      emailsSent: 0,
      evaluated: pending.length,
      note: "RESEND_API_KEY/RESEND_FROM_EMAIL belum diisi — email digest dilewati, notifikasi tetap ditandai diproses.",
    });
  }

  for (const userId of userIds) {
    const prefs = prefsByUser.get(userId) ?? {};
    const userNotifs = pending.filter((n) => String(n.user_id) === userId);
    for (const n of userNotifs) processedIds.push(String(n.id));

    const enabled = userNotifs.filter((n) => prefs[n.type as NotificationType] === true);
    if (!enabled.length) continue; // semua tipe untuk user ini OFF — tetap ditandai diproses di bawah, tidak dikirim email

    const { data: userResult } = await admin.auth.admin.getUserById(userId);
    const email = userResult?.user?.email;
    if (!email) continue;

    const items = enabled
      .map((n) => `<li><strong>${TYPE_LABEL[n.type as NotificationType] ?? n.type}:</strong> ${n.content}</li>`)
      .join("");

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: `${enabled.length} notifikasi baru di RANGKUL`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color:#16323C;">Ada yang perlu kamu lihat</h2>
              <ul style="padding-left: 18px; line-height: 1.6;">${items}</ul>
              <p style="margin: 24px 0;">
                <a href="${appUrl}/dashboard/notifications" style="background:#1F6F5C;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
                  Buka Notifikasi
                </a>
              </p>
              <p style="color:#5C7079;font-size:12px;">
                Atur jenis email yang kamu terima di ${appUrl}/dashboard/notifications/preferences
              </p>
            </div>
          `,
        }),
      });
      emailsSent += 1;
    } catch {
      // Fire-and-forget yang disengaja untuk SATU user tidak boleh menggagalkan
      // seluruh batch — user lain tetap harus diproses. Baris yang gagal di sini
      // tetap ditandai emailed_at (lihat catatan di docstring) supaya tidak retry
      // tanpa henti kalau penyebabnya persisten (mis. alamat email tidak valid).
    }
  }

  if (processedIds.length) {
    await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", processedIds);
  }

  return NextResponse.json({ ok: true, usersProcessed: userIds.length, emailsSent, evaluated: pending.length });
}
