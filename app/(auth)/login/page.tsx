"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

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
