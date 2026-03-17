import { supabase } from "@/lib/supabase/client";
import type { ProjectTypeOption } from "@/features/projects/types/project";

export async function getProjectTypeOptions(): Promise<ProjectTypeOption[]> {
  const { data, error } = await supabase
    .from("project_type_options")
    .select("id, type_name, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching project type options:", error);
    return [];
  }

  return (data ?? []) as ProjectTypeOption[];
}