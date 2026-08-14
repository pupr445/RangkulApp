import { getLabels, SectorKey } from "@/lib/labels/sectors";

export interface WorkflowStage {
  key: string;
  label: string;
  color?: string;
}

const FALLBACK_STAGES: WorkflowStage[] = [
  { key: "todo", label: "Belum Dikerjakan" },
  { key: "doing", label: "Sedang Dikerjakan" },
  { key: "done", label: "Selesai" },
];

export function defaultWorkflowForSector(sector: SectorKey): WorkflowStage[] {
  const labels = getLabels(sector);
  return labels.workflowStages.map((s) => ({ ...s }));
}

export function normalizeWorkflowStages(input: unknown, sector: SectorKey): WorkflowStage[] {
  const fallback = defaultWorkflowForSector(sector);
  if (!Array.isArray(input)) return fallback;
  const normalized = input
    .map((stage) => {
      const value = stage as Partial<WorkflowStage>;
      return {
        key: typeof value.key === "string" ? value.key.trim() : "",
        label: typeof value.label === "string" ? value.label.trim() : "",
        color: typeof value.color === "string" ? value.color : undefined,
      };
    })
    .filter((stage) => stage.key && stage.label);
  return normalized.length >= 2 ? normalized : fallback;
}

export function workflowStagesToStatusLabels(stages: WorkflowStage[]) {
  const labels = [...stages, ...FALLBACK_STAGES];
  return {
    todo: labels[0]?.label ?? FALLBACK_STAGES[0].label,
    doing: labels[1]?.label ?? FALLBACK_STAGES[1].label,
    done: labels[2]?.label ?? FALLBACK_STAGES[2].label,
  };
}
