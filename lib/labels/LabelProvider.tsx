"use client";

import { createContext, useContext, useMemo } from "react";
import { getLabels, LabelSet, SectorKey } from "./sectors";

interface LabelContextValue {
  labels: LabelSet;
  sector: SectorKey;
}

const LabelContext = createContext<LabelContextValue | null>(null);

/**
 * Bungkus bagian aplikasi yang butuh label dinamis dengan provider ini.
 * `sector` dan `overrides` idealnya diambil dari data organisasi yang
 * sedang login (lihat app/dashboard/layout.tsx untuk contoh pemakaian).
 */
export function LabelProvider({
  sector,
  overrides,
  children,
}: {
  sector: SectorKey;
  overrides?: Partial<LabelSet> | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ labels: getLabels(sector, overrides), sector }),
    [sector, overrides]
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
