import { supabase } from "@/lib/supabase/client";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import type { ProjectRecord } from "@/features/projects/types/project";
import {
  normalizeProjectRecords,
  type RawProjectRecord,
} from "@/features/projects/utils/normalize-project-record";

export async function getProjectsForUser(
  profile: UserProfile | null
): Promise<ProjectRecord[]> {
  if (!profile) {
    return [];
  }

  if (profile.role === "Admin") {
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
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects for admin:", error);
      return [];
    }

    return normalizeProjectRecords((data ?? []) as RawProjectRecord[]);
  }

  const { data: accessRows, error: accessError } = await supabase
    .from("user_project_access")
    .select("project_id")
    .eq("user_id", profile.id);

  if (accessError) {
    console.error("Error fetching project access mappings:", accessError);
    return [];
  }

  const projectIds = Array.from(
    new Set(
      (accessRows ?? [])
        .map((row) => row.project_id)
        .filter((projectId): projectId is number => typeof projectId === "number")
    )
  );

  if (projectIds.length === 0) {
    return [];
  }

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
    .eq("is_active", true)
    .in("id", projectIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects for user:", error);
    return [];
  }

  return normalizeProjectRecords((data ?? []) as RawProjectRecord[]);
}
