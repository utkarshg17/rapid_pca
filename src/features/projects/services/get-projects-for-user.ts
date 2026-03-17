import { supabase } from "@/lib/supabase/client";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import type { ProjectRecord } from "@/features/projects/types/project";

export async function getProjectsForUser(
  profile: UserProfile | null
): Promise<ProjectRecord[]> {
  if (!profile) {
    return [];
  }

  // Current phase:
  // Admin and non-admin can both read from project_database if the table/policies allow it.
  // Creation is restricted in the DB by RLS.
  // Later, this function is where you will enforce user_project_access filtering.
  const { data, error } = await supabase
    .from("project_database")
    .select(
      `
      id,
      created_at,
      project_name,
      project_code,
      expected_start_date,
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
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return (data ?? []) as unknown as ProjectRecord[];
}