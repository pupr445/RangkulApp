"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLabels, useCanManage } from "@/lib/labels/LabelProvider";
import { buildNavItems } from "@/lib/nav-items";

export function Sidebar() {
  const labels = useLabels();
  const canManage = useCanManage();
  const pathname = usePathname();

  const items = buildNavItems(labels, canManage);

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

