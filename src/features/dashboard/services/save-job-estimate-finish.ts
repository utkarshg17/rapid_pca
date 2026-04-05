import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateFinish,
  JobEstimateFinishRecord,
} from "@/features/dashboard/types/job-estimate";

type SaveJobEstimateFinishInput = {
  id?: number;
  jobEstimateId: number;
  finishType: string;
  description: string;
};

export async function saveJobEstimateFinish(
  input: SaveJobEstimateFinishInput
): Promise<JobEstimateFinish> {
  const payload = {
    job_estimate_id: input.jobEstimateId,
    finish_type: toNullableText(input.finishType),
    description: toNullableText(input.description),
  };

  const query = input.id
    ? supabase.from("job_estimate_finishes").update(payload).eq("id", input.id)
    : supabase.from("job_estimate_finishes").insert(payload);

  const { data, error } = await query
    .select("id, created_at, job_estimate_id, finish_type, description")
    .single();

  if (error) {
    console.error("Error saving finish row:", error);
    throw new Error(error.message || "Failed to save finish row.");
  }

  const row = data as JobEstimateFinishRecord;

  return {
    id: row.id,
    createdAt: row.created_at,
    jobEstimateId: row.job_estimate_id,
    finishType: row.finish_type ?? "",
    description: row.description ?? "",
  };
}

function toNullableText(value: string) {
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}
