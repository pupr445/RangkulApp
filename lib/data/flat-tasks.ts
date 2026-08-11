import { SectorKey } from "@/lib/labels/sectors";
import { sampleColumnsFor } from "./sample-tasks";

export interface FlatTask {
  id: string;
  title: string;
  tag: string;
  status: "todo" | "doing" | "done";
  due: string;
  assignee: string;
  assigneeId?: string;
  teamId?: string;
  customData?: Record<string, string>;
}

const STATUS_NAME_TO_KEY: Record<string, FlatTask["status"]> = {
  "Belum Dikerjakan": "todo",
  "Sedang Dikerjakan": "doing",
  Selesai: "done",
};

/** Dipakai saat organisasi belum punya tugas sungguhan di database. */
export function sampleFlatTasksFor(sector: SectorKey): FlatTask[] {
  const columns = sampleColumnsFor(sector);
  const flat: FlatTask[] = [];
  for (const col of columns) {
    const status = STATUS_NAME_TO_KEY[col.name] ?? "todo";
    for (const card of col.cards) {
      flat.push({
        id: card.id,
        title: card.title,
        tag: card.tag,
        status,
        due: card.due,
        assignee: card.assignee,
      });
    }
  }
  return flat;
}
