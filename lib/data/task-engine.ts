// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export interface ChecklistItem {
  id: string;
  task_id: string;
  label: string;
  is_done: boolean;
  position: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  tag: string | null;
  checklist_items: { label: string }[];
  custom_data: Record<string, string>;
}

export interface DependencyTask {
  id: string;
  title: string;
  status: string;
}

/** Ambil semua checklist item milik satu task, urut sesuai posisi. */
export async function fetchChecklist(supabase: SupabaseAny, taskId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("id, task_id, label, is_done, position")
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  if (error) return [];
  return (data ?? []) as ChecklistItem[];
}

export async function addChecklistItem(
  supabase: SupabaseAny,
  params: { taskId: string; organizationId: string; label: string; position: number; userId: string }
) {
  return supabase.from("task_checklist_items").insert([
    {
      task_id: params.taskId,
      organization_id: params.organizationId,
      label: params.label,
      position: params.position,
      created_by: params.userId,
    },
  ]);
}

export async function toggleChecklistItem(supabase: SupabaseAny, id: string, isDone: boolean) {
  return supabase.from("task_checklist_items").update({ is_done: isDone }).eq("id", id);
}

export async function deleteChecklistItem(supabase: SupabaseAny, id: string) {
  return supabase.from("task_checklist_items").delete().eq("id", id);
}

/** Ambil daftar task LAIN (dalam organisasi yang sama) yang jadi prasyarat task ini. */
export async function fetchDependencies(supabase: SupabaseAny, taskId: string): Promise<DependencyTask[]> {
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("depends_on_task_id, tasks:depends_on_task_id(id, title, status)")
    .eq("task_id", taskId);
  if (error) return [];
  return (data ?? [])
    .map((row: { tasks: DependencyTask | DependencyTask[] | null }) =>
      Array.isArray(row.tasks) ? row.tasks[0] : row.tasks
    )
    .filter(Boolean) as DependencyTask[];
}

export async function addDependency(
  supabase: SupabaseAny,
  params: { taskId: string; dependsOnTaskId: string; organizationId: string }
) {
  return supabase.from("task_dependencies").insert([
    {
      task_id: params.taskId,
      depends_on_task_id: params.dependsOnTaskId,
      organization_id: params.organizationId,
    },
  ]);
}

export async function removeDependency(supabase: SupabaseAny, taskId: string, dependsOnTaskId: string) {
  return supabase.from("task_dependencies").delete().eq("task_id", taskId).eq("depends_on_task_id", dependsOnTaskId);
}

/**
 * Task dianggap "diblokir" kalau ADA dependency yang statusnya belum di
 * stage final organisasi. finalStageKey diberikan dari luar (dari
 * workflow_stages organisasi) supaya helper ini tidak perlu tahu bentuk
 * workflow — cukup dikasih tahu apa "status selesai" itu.
 */
export function isBlockedByDependencies(dependencies: DependencyTask[], finalStageKey: string | null): boolean {
  if (!finalStageKey) return false;
  return dependencies.some((d) => d.status !== finalStageKey);
}

export async function fetchTaskTemplates(supabase: SupabaseAny, organizationId: string): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from("task_templates")
    .select("id, name, title, tag, checklist_items, custom_data")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as TaskTemplate[];
}

export async function saveTaskTemplate(
  supabase: SupabaseAny,
  params: {
    organizationId: string;
    name: string;
    title: string;
    tag: string;
    checklistItems: { label: string }[];
    customData: Record<string, string>;
    userId: string;
  }
) {
  return supabase.from("task_templates").insert([
    {
      organization_id: params.organizationId,
      name: params.name,
      title: params.title,
      tag: params.tag || null,
      checklist_items: params.checklistItems,
      custom_data: params.customData,
      created_by: params.userId,
    },
  ]);
}

export async function deleteTaskTemplate(supabase: SupabaseAny, id: string) {
  return supabase.from("task_templates").delete().eq("id", id);
}

export async function fetchWatchers(supabase: SupabaseAny, taskId: string): Promise<string[]> {
  const { data, error } = await supabase.from("task_watchers").select("user_id").eq("task_id", taskId);
  if (error) return [];
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}

export async function watchTask(supabase: SupabaseAny, params: { taskId: string; organizationId: string; userId: string }) {
  return supabase.from("task_watchers").insert([
    { task_id: params.taskId, organization_id: params.organizationId, user_id: params.userId },
  ]);
}

export async function unwatchTask(supabase: SupabaseAny, taskId: string, userId: string) {
  return supabase.from("task_watchers").delete().eq("task_id", taskId).eq("user_id", userId);
}
