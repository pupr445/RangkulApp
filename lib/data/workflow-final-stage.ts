/**
 * Dipakai HANYA di server (Route Handler dengan admin client) — bukan
 * pengganti lib/data/workflows.ts yang lebih lengkap untuk kebutuhan UI.
 * Cukup untuk keperluan cron: tahu key mana yang berarti "sudah selesai".
 */
export function resolveFinalStageKey(workflowStages: unknown): string | null {
  if (!Array.isArray(workflowStages) || workflowStages.length === 0) return null;
  const stages = workflowStages as Array<{ key?: unknown; final?: unknown }>;
  const finalStage = stages.find((s) => s.final === true) ?? stages[stages.length - 1];
  return typeof finalStage?.key === "string" ? finalStage.key : null;
}
