import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateFinish,
  JobEstimateFinishRecord,
} from "@/features/dashboard/types/job-estimate";

export async function getJobEstimateFinishes(
  estimateId: number
): Promise<JobEstimateFinish[]> {
  const { data, error } = await supabase
    .from("job_estimate_finishes")
    .select("id, created_at, job_estimate_id, finish_type, description")
    .eq("job_estimate_id", estimateId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching job estimate finishes:", error);
    return [];
  }

  return ((data ?? []) as JobEstimateFinishRecord[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    jobEstimateId: row.job_estimate_id,
    finishType: row.finish_type ?? "",
    description: row.description ?? "",
  }));
}
