import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimate,
  JobEstimateRecord,
} from "@/features/dashboard/types/job-estimate";

type CreateJobEstimateInput = {
  projectName: string;
  projectType: string;
};

export async function createJobEstimate(
  input: CreateJobEstimateInput
): Promise<JobEstimate> {
  const { data, error } = await supabase
    .from("job_estimate")
    .insert({
      project_name: input.projectName.trim(),
      project_type: input.projectType.trim(),
    })
    .select("id, created_at, project_name, project_type")
    .single();

  if (error) {
    console.error("Error creating job estimate:", error);
    throw new Error(error.message || "Failed to create job estimate.");
  }

  const row = data as JobEstimateRecord;

  return {
    id: row.id,
    createdAt: row.created_at,
    projectName: row.project_name,
    projectType: row.project_type,
  };
}
