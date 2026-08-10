/**
 * Placeholder tipe database.
 *
 * Setelah skema di supabase/schema.sql diterapkan ke project Supabase-mu,
 * generate ulang file ini dengan Supabase CLI supaya query type-safe:
 *
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > lib/types/database.ts
 *
 * Untuk sementara, tipe di bawah ini cukup longgar (loose) agar starter
 * tetap bisa di-build sebelum kamu menjalankan perintah di atas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseTable = { Row: any; Insert: any; Update: any };

export type Database = {
  public: {
    Tables: {
      organizations: LooseTable;
      organization_members: LooseTable;
      sector_templates: LooseTable;
      teams: LooseTable;
      projects: LooseTable;
      tasks: LooseTable;
      custom_fields: LooseTable;
      messages: LooseTable;
      activity_logs: LooseTable;
      [key: string]: LooseTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
