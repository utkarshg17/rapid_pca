import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimate,
  JobEstimateRecord,
} from "@/features/dashboard/types/job-estimate";

export async function getJobEstimates(): Promise<JobEstimate[]> {
  const { data, error } = await supabase
    .from("job_estimate")
    .select("id, created_at, project_name, project_type")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching job estimates:", error);
    return [];
  }

  return ((data ?? []) as JobEstimateRecord[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    projectName: row.project_name,
    projectType: row.project_type,
  }));
}
