/**
 * Custom Field per Sektor
 * ------------------------
 * Admin organisasi bisa menambahkan field data sendiri (misalnya "Nilai"
 * untuk sekolah, "Nama Pasien" untuk klinik) tanpa perlu mengubah kode.
 * Definisi field tersimpan di tabel `custom_fields` (lihat schema.sql),
 * nilainya tersimpan di kolom `tasks.custom_data` (JSONB — lihat migration
 * 004_custom_field_values.sql).
 */

export type CustomFieldType = "text" | "number" | "date" | "select";

export interface CustomFieldDef {
  id: string;
  field_key: string;
  field_label: string;
  field_type: CustomFieldType;
  /** Daftar pilihan, hanya terisi untuk field_type "select". */
  field_options?: string[] | null;
  /** Kalau true, field wajib diisi sebelum tugas bisa disimpan. */
  is_required?: boolean;
}

/** Ubah label field ("Nama Pasien") jadi key aman untuk disimpan ("nama_pasien"). */
export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTaskCustomFields(supabase: any, organizationId: string): Promise<CustomFieldDef[]> {
  const { data, error } = await supabase
    .from("custom_fields")
    .select("id, field_key, field_label, field_type, field_options, is_required")
    .eq("organization_id", organizationId)
    .eq("entity", "task")
    .order("created_at", { ascending: true });

  if (error) {
    // Gagal diam-diam di sini akan terlihat seperti "belum ada custom field
    // sama sekali" di UI, padahal penyebabnya bisa jadi migration
    // 009_custom_field_builder.sql belum dijalankan (kolom field_options /
    // is_required belum ada di database). Log supaya kelihatan di server.
    console.error("fetchTaskCustomFields gagal:", error.message);
  }

  return (data as CustomFieldDef[] | null) ?? [];
}
