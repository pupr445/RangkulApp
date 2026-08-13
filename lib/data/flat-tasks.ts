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

/** Dipakai saat organisasi belum punya tugas sungguhan di database. */
export function sampleFlatTasksFor(sector: SectorKey): FlatTask[] {
  const columns = sampleColumnsFor(sector);
  const flat: FlatTask[] = [];
  for (const col of columns) {
    // Kolom BoardColumn.id selalu "todo"/"doing"/"done" secara konsisten,
    // walau nama tampilannya (col.name) sudah berbeda-beda per sektor.
    const status = (["todo", "doing", "done"].includes(col.id) ? col.id : "todo") as FlatTask["status"];
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
