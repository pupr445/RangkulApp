import type { LabelSet } from "@/lib/labels/sectors";

export interface NavItem {
  icon: string;
  text: string;
  href: string;
}

export const NAV_ICONS = {
  team: "📋",
  members: "👥",
  task: "✅",
  calendar: "🗓️",
  chat: "💬",
  activity: "🕒",
  report: "📊",
  docs: "📁",
  settings: "⚙️",
};

/** Daftar item navigasi utama aplikasi — dipakai oleh Sidebar (desktop) dan MobileNav (HP), supaya keduanya selalu sinkron. */
export function buildNavItems(labels: LabelSet, canManage: boolean): NavItem[] {
  return [
    { icon: NAV_ICONS.team, text: labels.navTeam, href: "/dashboard" },
    { icon: NAV_ICONS.task, text: labels.navTask, href: "/dashboard/tasks" },
    { icon: NAV_ICONS.calendar, text: "Kalender", href: "/dashboard/calendar" },
    { icon: NAV_ICONS.chat, text: labels.navChat, href: "/dashboard/chat" },
    { icon: NAV_ICONS.activity, text: "Aktivitas", href: "/dashboard/activity" },
    { icon: "🔔", text: "Notifikasi", href: "/dashboard/notifications" },
    { icon: NAV_ICONS.report, text: labels.navReport, href: "/dashboard/reports" },
    { icon: NAV_ICONS.docs, text: labels.navDocs, href: "/dashboard/docs" },
    { icon: NAV_ICONS.members, text: "Anggota Tim", href: "/dashboard/team" },
    // Pengaturan hanya untuk Owner/Manager — Member biasa tidak boleh ubah
    // nama organisasi, sektor, tim, atau custom field (lihat RLS di
    // migration 006_role_based_access.sql).
    ...(canManage ? [{ icon: NAV_ICONS.settings, text: "Pengaturan", href: "/dashboard/settings" }] : []),
  ];
}
