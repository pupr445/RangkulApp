"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useSector, useCurrentUserRole, useSectorPosition } from "@/lib/labels/LabelProvider";
import { MobileNav } from "@/components/MobileNav";
import { NotificationBell } from "@/components/NotificationBell";

export function TopBar({ userName, organizationId }: { userName: string; organizationId: string }) {
  const labels = useLabels();
  const sector = useSector();
  const role = useCurrentUserRole();
  const sectorPosition = useSectorPosition();
  // Sengaja pakai istilah generik (Owner/Manager/Member), BUKAN
  // labels.ownerRole/managerRole/memberRole — istilah sektoral itu
  // untuk Sector Position (di bawah), bukan System Role. Mencampur
  // keduanya di sini persis bug yang dilaporkan (header selalu
  // menampilkan "Dokter Kepala" untuk SEMUA orang, padahal itu untuk
  // Owner saja dan sebenarnya posisi sektoral, bukan system role).
  const ROLE_DISPLAY: Record<typeof role, string> = { owner: "Owner", manager: "Manager", member: "Member" };
  const roleLabel = ROLE_DISPLAY[role];
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-surface border-b border-border px-4 sm:px-6 py-3.5 flex items-center gap-3 sm:gap-6 flex-wrap">
      <MobileNav />

      <div className="flex items-center gap-2 font-display font-bold text-lg">
        <span
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-white text-sm font-bold transition-colors"
          style={{ backgroundColor: labels.accent }}
        >
          {labels.icon}
        </span>
        RANGKUL
      </div>

      <span className="text-xs px-2.5 py-1 rounded-full bg-surfaceAlt text-inkMuted font-medium hidden sm:inline-block">
        {labels.sectorDisplayName}
      </span>

      <div className="ml-auto hidden md:flex flex-col gap-0.5 text-[11px] font-mono text-inkMuted bg-surfaceAlt border border-border rounded-lg px-3 py-1.5">
        <span>
          workspace.sector = <span className="text-ink">&quot;{sector}&quot;</span>
        </span>
        <span>
          label.manager → <span className="text-ink">&quot;{labels.managerRole}&quot;</span>
        </span>
      </div>

      <div className="relative">
        <NotificationBell organizationId={organizationId} />
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 hover:bg-surfaceAlt rounded-lg px-1.5 py-1 -mx-1.5 transition"
        >
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold border-[1.5px]"
            style={{ borderColor: labels.accent, color: labels.accent, backgroundColor: labels.accentSoft }}
          >
            {userName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="leading-tight text-left">
            <div className="text-sm font-semibold">{userName}</div>
            <div className="text-xs text-inkMuted">
              {sectorPosition ? `${sectorPosition} · ${roleLabel}` : roleLabel}
            </div>
          </div>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-lg shadow-card py-1.5 z-20">
              <a
                href="/dashboard/settings"
                className="block px-4 py-2 text-sm text-ink hover:bg-surfaceAlt transition"
              >
                ⚙️ Pengaturan Organisasi
              </a>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-[#8A3E24] hover:bg-surfaceAlt transition"
              >
                ↪ Keluar
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
