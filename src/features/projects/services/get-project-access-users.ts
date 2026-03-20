import { supabase } from "@/lib/supabase/client";
import type { ProjectAccessUser } from "@/features/projects/types/project";

export async function getProjectAccessUsers(
  projectId: number
): Promise<ProjectAccessUser[]> {
  const { data: adminUsers, error: adminError } = await supabase
    .from("user_database")
    .select("id, first_name, last_name, email_id, role")
    .eq("is_active", true)
    .eq("role", "Admin")
    .order("first_name", { ascending: true });

  if (adminError) {
    console.error("Error fetching admin project access users:", adminError);
    return [];
  }

  const { data: accessRows, error: accessError } = await supabase
    .from("user_project_access")
    .select("user_id")
    .eq("project_id", projectId);

  if (accessError) {
    console.error("Error fetching project access mappings:", accessError);
    return (adminUsers ?? []) as ProjectAccessUser[];
  }

  const mappedUserIds = Array.from(
    new Set(
      (accessRows ?? [])
        .map((row) => row.user_id)
        .filter((userId): userId is string => typeof userId === "string")
    )
  );

  if (mappedUserIds.length === 0) {
    return (adminUsers ?? []) as ProjectAccessUser[];
  }

  const { data: mappedUsers, error: mappedUsersError } = await supabase
    .from("user_database")
    .select("id, first_name, last_name, email_id, role")
    .eq("is_active", true)
    .in("id", mappedUserIds)
    .order("first_name", { ascending: true });

  if (mappedUsersError) {
    console.error("Error fetching mapped project access users:", mappedUsersError);
    return (adminUsers ?? []) as ProjectAccessUser[];
  }

  const dedupedUsers = new Map<string, ProjectAccessUser>();

  [...(adminUsers ?? []), ...(mappedUsers ?? [])].forEach((user) => {
    dedupedUsers.set(user.id, user as ProjectAccessUser);
  });

  return Array.from(dedupedUsers.values()).sort((left, right) => {
    const leftName = `${left.first_name ?? ""} ${left.last_name ?? ""}`.trim();
    const rightName = `${right.first_name ?? ""} ${right.last_name ?? ""}`.trim();

    return leftName.localeCompare(rightName);
  });
}
