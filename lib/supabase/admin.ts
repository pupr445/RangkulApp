import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client dengan SERVICE ROLE KEY — melewati RLS sepenuhnya.
 * HANYA dipakai di Route Handler (server), TIDAK PERNAH di komponen client
 * atau dikirim ke browser. Kalau env var ini tidak diisi, fungsi ini
 * sengaja melempar error yang jelas alih-alih diam-diam gagal.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diisi di environment variables. Lihat README bagian setup."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
