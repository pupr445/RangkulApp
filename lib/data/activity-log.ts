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
  | "document.uploaded"
  | "document.new_version";

export interface ActivityLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: ActivityAction | string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  team_id: string | null;
  detail: string | null;
  created_at: string;
}

export interface SecurityAuditEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  team_id: string | null;
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
    teamId?: string | null;
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
  opts: { limit?: number; targetType?: string; actorId?: string; teamId?: string; fromDate?: string; toDate?: string } = {}
): Promise<ActivityLogEntry[]> {
  let query = supabase
    .from("activity_logs")
    .select("id, actor_id, actor_name, action, target_type, target_id, target_label, team_id, detail, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.targetType) query = query.eq("target_type", opts.targetType);
  if (opts.actorId) query = query.eq("actor_id", opts.actorId);
  if (opts.teamId) query = query.eq("team_id", opts.teamId);
  if (opts.fromDate) query = query.gte("created_at", `${opts.fromDate}T00:00:00`);
  if (opts.toDate) query = query.lte("created_at", `${opts.toDate}T23:59:59.999`);

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
  "document.new_version": "mengunggah versi baru dokumen",
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


// Catatan security-sensitive. Ditulis lewat endpoint server (/api/audit-log)
// yang memakai service role, BUKAN langsung dari client — supaya penulisan
// audit trail tidak bisa gagal diam-diam hanya karena RLS menolak sesi
// client saat itu. Endpoint server sendiri yang memverifikasi identitas
// pemanggil sebelum menulis.
//
// Fire-and-forget yang disengaja (tidak di-await oleh pemanggil), tapi
// kegagalannya tetap dilaporkan lewat onError — pemanggil BOLEH mengabaikan
// onError untuk aksi non-kritis, tapi setidaknya tersedia alih-alih hanya
// console.error yang tidak pernah terlihat siapa pun di production.
export function logSecurityAudit(
  params: {
    organizationId: string;
    actorId: string;
    actorName: string;
    action: string;
    targetType?: string;
    targetId?: string | null;
    targetLabel?: string | null;
    teamId?: string | null;
    detail?: string | null;
  },
  onError?: (message: string) => void
) {
  fetch("/api/audit-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    })
    .catch((err: Error) => {
      console.error("logSecurityAudit gagal:", err.message);
      onError?.(err.message);
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchSecurityAuditLog(
  supabase: any,
  organizationId: string,
  opts: { limit?: number; actorId?: string; action?: string; teamId?: string; fromDate?: string; toDate?: string } = {}
): Promise<SecurityAuditEntry[]> {
  let query = supabase
    .from("security_audit_logs")
    .select("id, actor_id, actor_name, action, target_type, target_id, target_label, team_id, detail, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);

  if (opts.actorId) query = query.eq("actor_id", opts.actorId);
  if (opts.action) query = query.eq("action", opts.action);
  if (opts.teamId) query = query.eq("team_id", opts.teamId);
  if (opts.fromDate) query = query.gte("created_at", `${opts.fromDate}T00:00:00`);
  if (opts.toDate) query = query.lte("created_at", `${opts.toDate}T23:59:59.999`);

  const { data, error } = await query;
  if (error) {
    console.error("fetchSecurityAuditLog gagal:", error.message);
    return [];
  }
  return (data as SecurityAuditEntry[] | null) ?? [];
}
