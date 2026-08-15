"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { fetchNotifications, markNotificationsRead, notificationIcon, type NotificationRow, type NotificationType } from "@/lib/data/notifications";

function relativeTime(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return "baru saja";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const FILTERS: { key: "all" | "unread" | NotificationType; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "unread", label: "Belum dibaca" },
  { key: "assignment", label: "Penugasan" },
  { key: "mention", label: "Mention" },
  { key: "dm", label: "Pesan" },
  { key: "status_changed", label: "Status" },
  { key: "deadline", label: "Deadline" },
  { key: "overdue", label: "Terlambat" },
  { key: "invitation", label: "Undangan" },
];

export default function NotificationsPage() {
  const labels = useLabels();
  const userId = useCurrentUserId();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const supabase = createClient();

  async function load() {
    if (!userId) return;
    setLoading(true);
    setItems(await fetchNotifications(supabase, userId, 100));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notifications-page-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => prev.some((n) => n.id === (payload.new as NotificationRow).id) ? prev : [payload.new as NotificationRow, ...prev])
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filtered = useMemo(() => items.filter((n) =>
    filter === "all" ? true : filter === "unread" ? !n.is_read : n.type === filter
  ), [items, filter]);
  const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    setItems((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, is_read: true } : n));
    await markNotificationsRead(supabase, ids);
  }

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Notifikasi</h1>
          <p className="text-sm text-inkMuted">Semua pemberitahuan aktivitas yang berkaitan dengan pekerjaanmu.</p>
        </div>
        <button disabled={!unreadIds.length} onClick={() => markRead(unreadIds)} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border disabled:opacity-40 hover:bg-surfaceAlt">
          Tandai semua dibaca
        </button>
      </div>

      <div className="mb-5">
        <Link href="/dashboard/notifications/preferences" className="text-xs font-semibold hover:underline" style={{ color: labels.accent }}>
          Atur email notifikasi →
        </Link>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filter === f.key ? "text-white border-transparent" : "text-inkMuted border-border hover:bg-surfaceAlt"}`} style={filter === f.key ? { backgroundColor: labels.accent } : undefined}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-inkMuted">Memuat…</p> : filtered.length === 0 ? <p className="text-sm text-inkMuted">Tidak ada notifikasi pada filter ini.</p> : (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          {filtered.map((n, i) => (
            <div key={n.id} className={`px-5 py-4 flex items-start gap-3 ${i !== filtered.length - 1 ? "border-b border-border" : ""} ${n.is_read ? "" : "bg-surfaceAlt/50"}`}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0" style={{ backgroundColor: labels.accentSoft }}>{notificationIcon(n.type)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{n.content}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-inkMuted">
                  <span>{relativeTime(n.created_at)}</span>
                  {!n.is_read && <span>• Belum dibaca</span>}
                </div>
                {n.link && <Link href={n.link} onClick={() => !n.is_read && markRead([n.id])} className="inline-block mt-2 text-xs font-semibold hover:underline" style={{ color: labels.accent }}>Buka</Link>}
              </div>
              {!n.is_read && <button onClick={() => markRead([n.id])} className="text-xs shrink-0 text-inkMuted hover:text-ink">Tandai dibaca</button>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
