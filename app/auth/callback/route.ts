import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Sertakan pesan errornya di URL redirect — supaya halaman login bisa
    // menampilkan alasan SEBENARNYA gagalnya (mis. "code verifier tidak
    // ditemukan", "invalid grant", dll), bukan cuma diam-diam kembali ke
    // form login tanpa penjelasan apa pun.
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed&reason=${encodeURIComponent(error.message)}`
    );
  }

  // Google/Supabase sendiri yang melaporkan gagal (mis. user membatalkan
  // login) — teruskan juga alasannya kalau ada.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  const reasonParam = providerError ? `&reason=${encodeURIComponent(providerError)}` : "";
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed${reasonParam}`);
}
