"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLabels, useCanManage } from "@/lib/labels/LabelProvider";

const ICONS = {
  team: "📋",
  members: "👥",
  task: "✅",
  calendar: "🗓️",
  chat: "💬",
  report: "📊",
  docs: "📁",
  settings: "⚙️",
};

export function Sidebar() {
  const labels = useLabels();
  const canManage = useCanManage();
  const pathname = usePathname();

  const items = [
    { icon: ICONS.team, text: labels.navTeam, href: "/dashboard" },
    { icon: ICONS.task, text: labels.navTask, href: "/dashboard/tasks" },
    { icon: ICONS.calendar, text: "Kalender", href: "/dashboard/calendar" },
    { icon: ICONS.chat, text: labels.navChat, href: "/dashboard/chat" },
    { icon: ICONS.report, text: labels.navReport, href: "/dashboard/reports" },
    { icon: ICONS.docs, text: labels.navDocs, href: "/dashboard/docs" },
    { icon: ICONS.members, text: "Anggota Tim", href: "/dashboard/team" },
    // Pengaturan hanya untuk Owner/Manager — Member biasa tidak boleh
    // ubah nama organisasi, sektor, tim, atau custom field (lihat RLS
    // di migration 006_role_based_access.sql).
    ...(canManage ? [{ icon: ICONS.settings, text: "Pengaturan", href: "/dashboard/settings" }] : []),
  ];

  return (
    <aside className="w-[230px] shrink-0 bg-surface border-r border-border p-3 hidden md:block">
      <div className="text-[11px] uppercase tracking-wide text-inkMuted font-semibold px-2.5 pt-2 pb-1.5">
        Menu
      </div>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.text + item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium cursor-pointer mb-0.5 transition ${
              active ? "text-ink" : "text-inkMuted hover:bg-surfaceAlt hover:text-ink"
            }`}
            style={active ? { backgroundColor: labels.accentSoft, color: labels.accent } : undefined}
          >
            <span className="w-[18px] text-center text-[15px]">{item.icon}</span>
            {item.text}
          </Link>
        );
      })}
    </aside>
  );
}

