import { WorkflowStage } from "@/lib/data/workflows";
import { CustomFieldDef } from "@/lib/data/custom-fields";

export interface OrganizationTemplate {
  id: string;
  organization_id: string;
  name: string;
  workflow_stages: WorkflowStage[];
  team_names: string[];
  custom_fields: Array<{
    field_label: string;
    field_type: CustomFieldDef["field_type"];
    field_options?: string[] | null;
    is_required?: boolean;
    number_min?: number | null;
    number_max?: number | null;
    date_min?: string | null;
    date_max?: string | null;
  }>;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchOrganizationTemplates(supabase: any, organizationId: string): Promise<OrganizationTemplate[]> {
  const { data, error } = await supabase
    .from("organization_templates")
    .select("id, organization_id, name, workflow_stages, team_names, custom_fields, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchOrganizationTemplates gagal:", error.message);
    return [];
  }
  return (data as OrganizationTemplate[] | null) ?? [];
}
