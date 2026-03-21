import { supabase } from "@/lib/supabase/client";
import type { CreateProjectInput } from "@/features/projects/types/project";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";

export async function createProject(
  input: CreateProjectInput,
  profile: UserProfile
) {
  if (!profile?.auth_user_id) {
    throw new Error("No authenticated user found.");
  }

  const payload = {
    project_name: input.project_name.trim(),
    project_type_id: input.project_type_id,
    expected_start_date: input.expected_start_date || null,
    plot_area: input.plot_area,
    project_footprint: input.project_footprint,
    basement_count: input.basement_count,
    stilt_count: input.stilt_count,
    podium_count: input.podium_count,
    floor_count: input.floor_count,
    foundation_type: input.foundation_type,
    super_structure_type: input.super_structure_type,

    city: input.city.trim() || null,
    state: input.state.trim() || null,
    country: input.country.trim() || null,
    site_address: input.site_address.trim() || null,

    client_name: input.client_name.trim() || null,
    architect: input.architect.trim() || null,
    project_manager: input.project_manager.trim() || null,
    site_incharge: input.site_incharge.trim() || null,

    created_by_auth_user_id: profile.auth_user_id,
    created_by_user_id: profile.id ? Number(profile.id) : null,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("project_database")
    .insert(payload)
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
    .single();

  if (error) {
    console.error("Error creating project:", error);
    throw new Error(error.message || "Failed to create project.");
  }

  return data;
}
