"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function LoginPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const invitedEmail = useMemo(() => searchParams.get("email")?.trim().toLowerCase() ?? "", [searchParams]);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-card shadow-card p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#3E7CB1] text-white flex items-center justify-center font-display font-bold text-xl mx-auto mb-4">
          R
        </div>
        <h1 className="text-xl font-display font-bold mb-1">Masuk ke RANGKUL</h1>
        <p className="text-sm text-inkMuted mb-6">
          Kelola pekerjaan &amp; komunikasi tim dalam satu aplikasi yang menyesuaikan sektormu.
        </p>
        {invitedEmail && (
          <div className="mb-4 rounded-lg border border-border bg-surfaceMuted px-3 py-2 text-left text-xs text-inkMuted">
            Undangan ditujukan ke <strong className="text-ink">{invitedEmail}</strong>. Gunakan akun Google dengan email tersebut agar undangan otomatis terdeteksi.
          </div>
        )}
        <button
          onClick={signInWithGoogle}
          className="w-full bg-ink text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 transition"
        >
          Lanjutkan dengan Google
        </button>
        <p className="text-xs text-inkMuted mt-4">
          Belum punya organisasi?{" "}
          <a href="/onboarding" className="underline">
            Buat organisasi baru
          </a>
        </p>
      </div>
    </div>
  );
}
