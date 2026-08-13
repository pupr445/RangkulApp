export type NotificationType = "mention" | "assignment" | "dm" | "status_changed";

export interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string | null;
  type: NotificationType;
  content: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Kirim notifikasi ke SATU user lain. Fire-and-forget — gagal mengirim
 * notifikasi tidak boleh membuat aksi utama (mis. assign tugas, kirim
 * pesan) terlihat gagal. Tidak mengirim ke diri sendiri (mis. assign
 * tugas ke diri sendiri tidak perlu notifikasi).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function notifyUser(
  supabase: any,
  params: {
    organizationId: string;
    recipientId: string;
    actorId: string;
    actorName: string;
    type: NotificationType;
    content: string;
    link?: string;
  }
) {
  if (params.recipientId === params.actorId) return;

  supabase
    .from("notifications")
    .insert([
      {
        organization_id: params.organizationId,
        user_id: params.recipientId,
        actor_id: params.actorId,
        actor_name: params.actorName,
        type: params.type,
        content: params.content,
        link: params.link ?? null,
      },
    ])
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error("notifyUser gagal:", error.message);
    });
}

/** Kirim notifikasi yang sama ke beberapa user sekaligus (mis. semua yang di-mention). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function notifyUsers(
  supabase: any,
  recipientIds: string[],
  params: {
    organizationId: string;
    actorId: string;
    actorName: string;
    type: NotificationType;
    content: string;
    link?: string;
  }
) {
  for (const recipientId of new Set(recipientIds)) {
    notifyUser(supabase, { ...params, recipientId });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchNotifications(supabase: any, userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, actor_id, actor_name, type, content, link, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchNotifications gagal:", error.message);
    return [];
  }
  return (data as NotificationRow[] | null) ?? [];
}

const TYPE_ICON: Record<NotificationType, string> = {
  mention: "💬",
  assignment: "✅",
  dm: "✉️",
  status_changed: "🔄",
};

export function notificationIcon(type: NotificationType): string {
  return TYPE_ICON[type] ?? "🔔";
}
