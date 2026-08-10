import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Dipakai di Server Components, Server Actions, dan Route Handlers.
 * Wajib dipanggil ulang tiap request (jangan disimpan sebagai singleton)
 * karena bergantung pada cookie request yang sedang berjalan.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Diabaikan jika dipanggil dari Server Component murni (read-only).
            // Middleware yang menangani refresh sesi — lihat middleware.ts.
          }
        },
      },
    }
  );
}
