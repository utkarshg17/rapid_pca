import { supabase } from "@/lib/supabase/client";
import type { CrewOption } from "@/features/projects/types/labour-sheet";

export async function getCrewOptions(): Promise<CrewOption[]> {
  const { data, error } = await supabase
    .from("crew_database")
    .select("crew_role_name, crew_code")
    .order("crew_role_name", { ascending: true });

  if (error) {
    console.error("Error fetching crew options:", error);
    return [];
  }

  const uniqueOptions = new Map<string, CrewOption>();

  (data ?? []).forEach((row) => {
    if (
      typeof row.crew_role_name !== "string" ||
      typeof row.crew_code !== "string"
    ) {
      return;
    }

    if (!uniqueOptions.has(row.crew_role_name)) {
      uniqueOptions.set(row.crew_role_name, {
        crew_role_name: row.crew_role_name,
        crew_code: row.crew_code,
      });
    }
  });

  return Array.from(uniqueOptions.values());
}
