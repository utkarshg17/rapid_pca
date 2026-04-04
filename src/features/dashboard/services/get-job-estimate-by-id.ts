import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimate,
  JobEstimateRecord,
} from "@/features/dashboard/types/job-estimate";

export async function getJobEstimateById(
  estimateId: number
): Promise<JobEstimate | null> {
  const { data, error } = await supabase
    .from("job_estimate")
    .select("id, created_at, project_name, project_type")
    .eq("id", estimateId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching job estimate:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const row = data as JobEstimateRecord;

  return {
    id: row.id,
    createdAt: row.created_at,
    projectName: row.project_name,
    projectType: row.project_type,
  };
}
