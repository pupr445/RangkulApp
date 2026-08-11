"use client";

import { createContext, useContext, useMemo } from "react";
import { getLabels, LabelSet, SectorKey } from "./sectors";

export type OrgRole = "owner" | "manager" | "member";

interface LabelContextValue {
  labels: LabelSet;
  sector: SectorKey;
  role: OrgRole;
  userId: string;
}

const LabelContext = createContext<LabelContextValue | null>(null);

/**
 * Bungkus bagian aplikasi yang butuh label dinamis dengan provider ini.
 * `sector` dan `overrides` idealnya diambil dari data organisasi yang
 * sedang login (lihat app/dashboard/layout.tsx untuk contoh pemakaian).
 *
 * `role` dan `userId` dipakai komponen UI untuk menyembunyikan aksi yang
 * tidak diizinkan (mis. tombol Hapus, form Undang Anggota) — ini lapisan
 * kenyamanan tampilan saja. Keamanan SEBENARNYA ditegakkan lewat Row Level
 * Security di database (lihat supabase/migrations/006_role_based_access.sql),
 * jadi meski UI ini dilewati, database tetap menolak aksi yang tidak sah.
 */
export function LabelProvider({
  sector,
  overrides,
  role = "member",
  userId = "",
  children,
}: {
  sector: SectorKey;
  overrides?: Partial<LabelSet> | null;
  role?: OrgRole;
  userId?: string;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ labels: getLabels(sector, overrides), sector, role, userId }),
    [sector, overrides, role, userId]
  );

  return <LabelContext.Provider value={value}>{children}</LabelContext.Provider>;
}

export function useLabels(): LabelSet {
  const ctx = useContext(LabelContext);
  if (!ctx) {
    throw new Error("useLabels() harus dipanggil di dalam <LabelProvider>");
  }
  return ctx.labels;
}

export function useSector(): SectorKey {
  const ctx = useContext(LabelContext);
  if (!ctx) {
    throw new Error("useSector() harus dipanggil di dalam <LabelProvider>");
  }
  return ctx.sector;
}

/** true jika user saat ini owner atau manager (boleh kelola tim/field/undangan). */
export function useCanManage(): boolean {
  const ctx = useContext(LabelContext);
  if (!ctx) {
    throw new Error("useCanManage() harus dipanggil di dalam <LabelProvider>");
  }
  return ctx.role === "owner" || ctx.role === "manager";
}

export function useCurrentUserId(): string {
  const ctx = useContext(LabelContext);
  if (!ctx) {
    throw new Error("useCurrentUserId() harus dipanggil di dalam <LabelProvider>");
  }
  return ctx.userId;
}
