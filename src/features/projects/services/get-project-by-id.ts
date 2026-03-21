import { supabase } from "@/lib/supabase/client";
import type { ProjectRecord } from "@/features/projects/types/project";

export async function getProjectById(
  projectId: number
): Promise<ProjectRecord | null> {
  const { data, error } = await supabase
    .from("project_database")
    .select(
      `
      id,
      created_at,
      project_name,
      project_code,
      expected_start_date,
      plot_area,
      project_footprint,
      basement_count,
      stilt_count,
      podium_count,
      floor_count,
      foundation_type,
      super_structure_type,
      city,
      state,
      country,
      site_address,
      client_name,
      architect,
      project_manager,
      site_incharge,
      is_active,
      project_type_options (
        id,
        type_name
      )
    `
    )
    .eq("id", projectId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching project:", error);
    return null;
  }

  return (data ?? null) as ProjectRecord | null;
}
