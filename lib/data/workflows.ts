import { getLabels, SectorKey } from "@/lib/labels/sectors";

export interface WorkflowStage {
  key: string;
  label: string;
  color?: string;
  initial?: boolean;
  final?: boolean;
  transitions?: string[];
}

const FALLBACK_STAGES: WorkflowStage[] = [
  { key: "todo", label: "Belum Dikerjakan", color: "#64748B", initial: true, final: false, transitions: ["doing"] },
  { key: "doing", label: "Sedang Dikerjakan", color: "#2563EB", initial: false, final: false, transitions: ["done"] },
  { key: "done", label: "Selesai", color: "#16A34A", initial: false, final: true, transitions: [] },
];

export function defaultWorkflowForSector(sector: SectorKey): WorkflowStage[] {
  const labels = getLabels(sector);
  const stages = labels.workflowStages.map((s, index, arr) => ({
    ...s,
    color: index === 0 ? "#64748B" : index === arr.length - 1 ? "#16A34A" : "#2563EB",
    initial: index === 0,
    final: index === arr.length - 1,
    transitions: index < arr.length - 1 ? [arr[index + 1].key] : [],
  }));
  return normalizeWorkflowStages(stages, sector);
}

export function normalizeWorkflowStages(input: unknown, sector: SectorKey): WorkflowStage[] {
  const fallback = [...FALLBACK_STAGES];
  if (!Array.isArray(input)) return defaultWorkflowForSectorWithoutLoop(sector, fallback);

  const normalized = input
    .map((stage) => {
      const value = stage as Partial<WorkflowStage>;
      return {
        key: typeof value.key === "string" ? value.key.trim() : "",
        label: typeof value.label === "string" ? value.label.trim() : "",
        color: typeof value.color === "string" && value.color.trim() ? value.color : "#2563EB",
        initial: Boolean(value.initial),
        final: Boolean(value.final),
        transitions: Array.isArray(value.transitions)
          ? value.transitions.filter((x): x is string => typeof x === "string")
          : [],
      };
    })
    .filter((stage) => stage.key && stage.label);

  if (normalized.length < 2) return defaultWorkflowForSectorWithoutLoop(sector, fallback);

  // Tepat satu initial, default ke tahap pertama.
  const firstInitial = normalized.findIndex((s) => s.initial);
  normalized.forEach((s, i) => { s.initial = firstInitial === -1 ? i === 0 : i === firstInitial; });

  // Minimal satu final, default ke tahap terakhir.
  if (!normalized.some((s) => s.final)) normalized[normalized.length - 1].final = true;

  // Transition hanya boleh menunjuk ke stage yang memang ada.
  const keys = new Set(normalized.map((s) => s.key));
  normalized.forEach((s, index) => {
    s.transitions = s.transitions.filter((key) => keys.has(key) && key !== s.key);
    if (index < normalized.length - 1 && s.transitions.length === 0) {
      s.transitions = [normalized[index + 1].key];
    }
    if (s.final) s.transitions = [];
  });

  return normalized;
}

function defaultWorkflowForSectorWithoutLoop(sector: SectorKey, fallback: WorkflowStage[]) {
  const labels = getLabels(sector);
  return labels.workflowStages.map((s, index, arr) => ({
    ...s,
    color: index === 0 ? fallback[0].color : index === arr.length - 1 ? fallback[2].color : fallback[1].color,
    initial: index === 0,
    final: index === arr.length - 1,
    transitions: index < arr.length - 1 ? [arr[index + 1].key] : [],
  }));
}

export function getInitialWorkflowStage(stages: WorkflowStage[]) {
  return stages.find((s) => s.initial) ?? stages[0];
}

export function canTransitionWorkflow(stages: WorkflowStage[], from: string, to: string): boolean {
  if (!from || from === to) return true;
  const current = stages.find((s) => s.key === from);
  if (!current) return true; // kompatibilitas data lama
  if (current.final) return false;
  if (!current.transitions?.length) return true; // kompatibilitas workflow lama
  return current.transitions.includes(to);
}

export function workflowStageColor(stages: WorkflowStage[], key: string) {
  return stages.find((s) => s.key === key)?.color ?? "#64748B";
}

export function workflowStagesToStatusLabels(stages: WorkflowStage[]) {
  const labels = [...stages, ...FALLBACK_STAGES];
  return {
    todo: labels[0]?.label ?? FALLBACK_STAGES[0].label,
    doing: labels[1]?.label ?? FALLBACK_STAGES[1].label,
    done: labels[2]?.label ?? FALLBACK_STAGES[2].label,
  };
}
