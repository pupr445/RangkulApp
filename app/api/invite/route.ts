import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/**
 * POST /api/invite
 * Body: { email: string, role: "manager" | "member" }
 *
 * Membuat/memperbarui baris di tabel `invitations` untuk organisasi milik
 * user yang sedang login, lalu (jika RESEND_API_KEY sudah diisi di env)
 * mengirim email undangan lewat Resend.
 *
 * RESEND_API_KEY sengaja TIDAK diberi prefix NEXT_PUBLIC_ — supaya hanya
 * bisa dibaca di server (Route Handler ini), tidak pernah terkirim ke
 * browser. Kalau env ini kosong, endpoint tetap membuat undangannya,
 * hanya saja emailSent akan bernilai false sehingga UI menampilkan
 * instruksi manual seperti sebelumnya.
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
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const role = (body?.role as string | undefined) === "manager" ? "manager" : "member";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  }

  // Cari organisasi milik/tempat user ini bergabung (owner atau member).
  const { data: ownedOrg } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();

  let org = ownedOrg as { id: string; name: string } | null;

  if (!org) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership) {
      const { data: memberOrg } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", (membership as { organization_id: string }).organization_id)
        .maybeSingle();
      org = memberOrg as { id: string; name: string } | null;
    }
  }

  if (!org) {
    return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error: upsertError } = await client
    .from("invitations")
    .upsert(
      { organization_id: org.id, email, role, accepted: false, invited_by: user.id },
      { onConflict: "organization_id,email" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Kirim email lewat Resend, kalau sudah dikonfigurasi.
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  let emailSent = false;
  let emailError: string | null = null;

  if (resendApiKey && fromEmail) {
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const inviterName =
      (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Seseorang";

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: `${inviterName} mengundangmu bergabung ke ${org.name} di RANGKUL`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color:#16323C;">Kamu diundang bergabung!</h2>
              <p><strong>${inviterName}</strong> mengundangmu bergabung ke <strong>${org.name}</strong> di RANGKUL.</p>
              <p>Klik tombol di bawah, lalu login dengan Google memakai alamat email ini
                 (<strong>${email}</strong>) — kamu akan otomatis masuk ke organisasi tersebut.</p>
              <p style="margin: 24px 0;">
                <a href="${origin}/login" style="background:#3E7CB1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
                  Buka RANGKUL
                </a>
              </p>
              <p style="color:#5C7079;font-size:12px;">Kalau kamu tidak mengenal pengirim, abaikan saja email ini.</p>
            </div>
          `,
        }),
      });

      if (res.ok) {
        emailSent = true;
      } else {
        const errBody = await res.json().catch(() => null);
        emailError = errBody?.message ?? `Resend merespons status ${res.status}`;
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Gagal menghubungi Resend.";
    }
  }

  return NextResponse.json({ ok: true, emailSent, emailError });
}
