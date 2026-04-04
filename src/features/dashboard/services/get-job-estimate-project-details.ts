import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimate,
  JobEstimateProjectDetails,
  JobEstimateProjectDetailsRecord,
} from "@/features/dashboard/types/job-estimate";

export async function getJobEstimateProjectDetails(
  estimate: JobEstimate
): Promise<JobEstimateProjectDetails> {
  const { data, error } = await supabase
    .from("job_estimate_project_details")
    .select(
      "id, created_at, job_estimate_project_id, project_name, project_type, client, architect, contract_type, submission_deadline, tender_estimated_amount, city, state, country, total_plot_area, boundary_wall, basement_count, basement_area, superstructure_footprint, stilt_floor_count, floor_count, foundation_type, superstructure_type, created_by_id, created_by_name"
    )
    .eq("job_estimate_project_id", estimate.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching job estimate project details:", error);
    return createDefaultJobEstimateProjectDetails(estimate);
  }

  if (!data) {
    return createDefaultJobEstimateProjectDetails(estimate);
  }

  const row = data as JobEstimateProjectDetailsRecord;

  return {
    id: row.id,
    jobEstimateProjectId: row.job_estimate_project_id,
    projectName: row.project_name,
    projectType: row.project_type,
    client: row.client ?? "",
    architect: row.architect ?? "",
    contractType: row.contract_type ?? "",
    submissionDeadline: row.submission_deadline ?? "",
    tenderEstimatedAmount: formatOptionalNumber(row.tender_estimated_amount),
    city: row.city ?? "",
    state: row.state ?? "",
    country: row.country ?? "",
    totalPlotArea: formatOptionalNumber(row.total_plot_area),
    boundaryWall:
      row.boundary_wall === null ? "" : row.boundary_wall ? "Yes" : "No",
    basementCount: formatOptionalInteger(row.basement_count),
    basementArea: formatOptionalNumber(row.basement_area),
    superstructureFootprint: formatOptionalNumber(
      row.superstructure_footprint
    ),
    stiltFloorCount: formatOptionalInteger(row.stilt_floor_count),
    floorCount: formatOptionalInteger(row.floor_count),
    foundationType: row.foundation_type ?? "",
    superstructureType: row.superstructure_type ?? "",
    createdById: row.created_by_id,
    createdByName: row.created_by_name ?? "",
    createdAt: row.created_at,
  };
}

export function createDefaultJobEstimateProjectDetails(
  estimate: JobEstimate
): JobEstimateProjectDetails {
  return {
    id: null,
    jobEstimateProjectId: estimate.id,
    projectName: estimate.projectName,
    projectType: estimate.projectType,
    client: "",
    architect: "",
    contractType: "",
    submissionDeadline: "",
    tenderEstimatedAmount: "",
    city: "",
    state: "",
    country: "",
    totalPlotArea: "",
    boundaryWall: "",
    basementCount: "",
    basementArea: "",
    superstructureFootprint: "",
    stiltFloorCount: "",
    floorCount: "",
    foundationType: "",
    superstructureType: "",
    createdById: null,
    createdByName: "",
    createdAt: null,
  };
}

function formatOptionalNumber(value: number | null) {
  if (value === null) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : String(value);
}

function formatOptionalInteger(value: number | null) {
  if (value === null) {
    return "";
  }

  return String(value);
}
