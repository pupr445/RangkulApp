export type ActivityAction =
  | "task.created"
  | "task.status_changed"
  | "task.deleted"
  | "team.created"
  | "team.deleted"
  | "team.member_added"
  | "team.member_removed"
  | "task.updated"
  | "task.assignee_changed"
  | "task.team_changed"
  | "member.invited"
  | "custom_field.created"
  | "custom_field.updated"
  | "workflow.updated"
  | "template.created"
  | "template.applied"
  | "document.uploaded";

export interface ActivityLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: ActivityAction | string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  detail: string | null;
  created_at: string;
}

/**
 * Catat satu baris aktivitas. Dipanggil dari Client Component langsung
 * setelah aksi utama berhasil (buat/hapus/ubah) — mengikuti pola yang
 * sama dengan insert lain di app ini (RLS activity_logs_insert cuma
 * mensyaratkan is_org_member, jadi aman dipanggil dari browser).
 *
 * Sengaja "fire and forget" (tidak menahan UI / tidak melempar error ke
 * pemanggil) — gagal mencatat log tidak boleh membuat aksi utama
 * (mis. buat tugas) terlihat gagal juga.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logActivity(
  supabase: any,
  params: {
    organizationId: string;
    actorId: string;
    actorName: string;
    action: ActivityAction;
    targetType?: string;
    targetId?: string | null;
    targetLabel?: string | null;
    detail?: string | null;
  }
) {
  supabase
    .from("activity_logs")
    .insert([
      {
        organization_id: params.organizationId,
        actor_id: params.actorId,
        actor_name: params.actorName,
        action: params.action,
        target_type: params.targetType ?? null,
        target_id: params.targetId ?? null,
        target_label: params.targetLabel ?? null,
        detail: params.detail ?? null,
      },
    ])
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error("logActivity gagal:", error.message);
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchActivityLog(
  supabase: any,
  organizationId: string,
  opts: { limit?: number; targetType?: string; actorId?: string } = {}
): Promise<ActivityLogEntry[]> {
  let query = supabase
    .from("activity_logs")
    .select("id, actor_id, actor_name, action, target_type, target_id, target_label, detail, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.targetType) query = query.eq("target_type", opts.targetType);
  if (opts.actorId) query = query.eq("actor_id", opts.actorId);

  const { data, error } = await query;
  if (error) {
    console.error("fetchActivityLog gagal:", error.message);
    return [];
  }
  return (data as ActivityLogEntry[] | null) ?? [];
}

const ACTION_VERB: Record<string, string> = {
  "task.created": "membuat",
  "task.status_changed": "mengubah status",
  "task.deleted": "menghapus",
  "team.created": "membuat",
  "team.deleted": "menghapus",
  "team.member_added": "menambahkan anggota ke",
  "team.member_removed": "mengeluarkan anggota dari",
  "task.updated": "mengubah",
  "task.assignee_changed": "mengubah penanggung jawab",
  "task.team_changed": "memindahkan",
  "member.invited": "mengundang",
  "custom_field.created": "menambahkan field",
  "custom_field.updated": "mengubah field",
  "workflow.updated": "mengubah workflow",
  "template.created": "membuat template",
  "template.applied": "menerapkan template",
  "document.uploaded": "mengunggah dokumen",
};

const TARGET_NOUN: Record<string, string> = {
  task: "tugas",
  team: "tim",
  member: "anggota",
  custom_field: "field",
  document: "dokumen",
  template: "template",
};

/** Ubah satu entri log jadi kalimat Indonesia yang enak dibaca, mis. "Budi mengubah status tugas \"Rapat\" menjadi Selesai". */
export function describeActivity(entry: ActivityLogEntry): string {
  const actor = entry.actor_name ?? "Seseorang";
  const verb = ACTION_VERB[entry.action] ?? entry.action;
  const noun = entry.target_type ? TARGET_NOUN[entry.target_type] ?? entry.target_type : "";
  const label = entry.target_label ? ` "${entry.target_label}"` : "";
  const detail = entry.detail ? ` ${entry.detail}` : "";
  return `${actor} ${verb} ${noun}${label}${detail}`.replace(/\s+/g, " ").trim();
}
