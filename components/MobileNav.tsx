"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLabels, useCanManage } from "@/lib/labels/LabelProvider";
import { buildNavItems } from "@/lib/nav-items";

/**
 * Sidebar navigasi utama (components/Sidebar.tsx) sepenuhnya tersembunyi
 * di layar mobile (`hidden md:block`), dan sebelumnya tidak ada
 * penggantinya sama sekali — jadi seluruh aplikasi praktis tidak bisa
 * dinavigasi dari HP kecuali ketik URL manual. Komponen ini menutup
 * celah itu: tombol hamburger + drawer berisi item navigasi yang sama
 * persis dengan Sidebar (lewat buildNavItems), khusus untuk layar < md.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const labels = useLabels();
  const canManage = useCanManage();
  const pathname = usePathname();

  const items = buildNavItems(labels, canManage);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-border text-lg leading-none shrink-0"
      >
        ☰
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-[260px] bg-surface border-r border-border z-50 p-3 md:hidden overflow-y-auto">
            <div className="flex items-center justify-between px-2.5 pt-2 pb-3">
              <span className="text-[11px] uppercase tracking-wide text-inkMuted font-semibold">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Tutup menu" className="text-inkMuted text-xl leading-none px-1">
                ×
              </button>
            </div>
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.text + item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
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
        </>
      )}
    </>
  );
}
