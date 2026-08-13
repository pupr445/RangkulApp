"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { NotificationRow, fetchNotifications, notificationIcon } from "@/lib/data/notifications";

function relativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return `${Math.floor(diffHour / 24)} hari lalu`;
}

export function NotificationBell({ organizationId }: { organizationId: string }) {
  const labels = useLabels();
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;
    fetchNotifications(supabase, currentUserId).then((rows) => {
      setItems(rows);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Realtime: notifikasi baru untuk user ini muncul tanpa perlu refresh.
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  async function markAsRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    await client.from("notifications").update({ is_read: true }).in("id", ids);
  }

  function handleClickItem(n: NotificationRow) {
    if (!n.is_read) markAsRead([n.id]);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-border text-base hover:bg-surfaceAlt"
      >
        🔔
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ backgroundColor: labels.accent }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-lg shadow-card z-20 max-h-[420px] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border sticky top-0 bg-surface">
              <span className="text-sm font-semibold">Notifikasi</span>
              {unreadCount > 0 && (
                <button
                  onClick={() =>
                    markAsRead(items.filter((n) => !n.is_read).map((n) => n.id))
                  }
                  className="text-xs font-semibold hover:underline"
                  style={{ color: labels.accent }}
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>

            {!loaded ? (
              <p className="text-sm text-inkMuted px-4 py-6 text-center">Memuat…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-inkMuted px-4 py-6 text-center">Belum ada notifikasi.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left flex items-start gap-2.5 px-4 py-3 border-b border-border last:border-0 hover:bg-surfaceAlt transition ${
                    n.is_read ? "" : "bg-surfaceAlt/60"
                  }`}
                >
                  <span className="text-base shrink-0">{notificationIcon(n.type)}</span>
                  <div className="min-w-0">
                    <p className="text-xs leading-snug">{n.content}</p>
                    <p className="text-[11px] text-inkMuted mt-0.5">{relativeTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1 ml-auto"
                      style={{ backgroundColor: labels.accent }}
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
