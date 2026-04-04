import { supabase } from "@/lib/supabase/client";
import type { JobEstimateProjectDetails } from "@/features/dashboard/types/job-estimate";

export async function saveJobEstimateProjectDetails(
  details: JobEstimateProjectDetails
) {
  const payload = {
    job_estimate_project_id: details.jobEstimateProjectId,
    project_name: details.projectName.trim(),
    project_type: details.projectType.trim(),
    client: toNullableText(details.client),
    architect: toNullableText(details.architect),
    contract_type: toNullableText(details.contractType),
    submission_deadline: toNullableText(details.submissionDeadline),
    tender_estimated_amount: toNullableFloat(details.tenderEstimatedAmount),
    city: toNullableText(details.city),
    state: toNullableText(details.state),
    country: toNullableText(details.country),
    total_plot_area: toNullableFloat(details.totalPlotArea),
    boundary_wall: toNullableBoolean(details.boundaryWall),
    basement_count: toNullableInteger(details.basementCount),
    basement_area: toNullableFloat(details.basementArea),
    superstructure_footprint: toNullableFloat(details.superstructureFootprint),
    stilt_floor_count: toNullableInteger(details.stiltFloorCount),
    floor_count: toNullableInteger(details.floorCount),
    foundation_type: toNullableText(details.foundationType),
    superstructure_type: toNullableText(details.superstructureType),
    created_by_id: details.createdById,
    created_by_name: toNullableText(details.createdByName),
  };

  if (details.id) {
    const { data, error } = await supabase
      .from("job_estimate_project_details")
      .update(payload)
      .eq("id", details.id)
      .select(
        "id, created_at, job_estimate_project_id, project_name, project_type, client, architect, contract_type, submission_deadline, tender_estimated_amount, city, state, country, total_plot_area, boundary_wall, basement_count, basement_area, superstructure_footprint, stilt_floor_count, floor_count, foundation_type, superstructure_type, created_by_id, created_by_name"
      )
      .single();

    if (error) {
      console.error("Error updating job estimate project details:", error);
      throw new Error(
        error.message || "Failed to update project details."
      );
    }

    await syncJobEstimateBasics(details.jobEstimateProjectId, details);

    return data;
  }

  const { data: existingRow, error: existingRowError } = await supabase
    .from("job_estimate_project_details")
    .select("id")
    .eq("job_estimate_project_id", details.jobEstimateProjectId)
    .maybeSingle();

  if (existingRowError) {
    console.error(
      "Error checking existing job estimate project details:",
      existingRowError
    );
    throw new Error(
      existingRowError.message || "Failed to check existing project details."
    );
  }

  if (existingRow?.id) {
    const { data, error } = await supabase
      .from("job_estimate_project_details")
      .update(payload)
      .eq("id", existingRow.id)
      .select(
        "id, created_at, job_estimate_project_id, project_name, project_type, client, architect, contract_type, submission_deadline, tender_estimated_amount, city, state, country, total_plot_area, boundary_wall, basement_count, basement_area, superstructure_footprint, stilt_floor_count, floor_count, foundation_type, superstructure_type, created_by_id, created_by_name"
      )
      .single();

    if (error) {
      console.error("Error updating job estimate project details:", error);
      throw new Error(
        error.message || "Failed to update project details."
      );
    }

    await syncJobEstimateBasics(details.jobEstimateProjectId, details);

    return data;
  }

  const { data, error } = await supabase
    .from("job_estimate_project_details")
    .insert(payload)
    .select(
      "id, created_at, job_estimate_project_id, project_name, project_type, client, architect, contract_type, submission_deadline, tender_estimated_amount, city, state, country, total_plot_area, boundary_wall, basement_count, basement_area, superstructure_footprint, stilt_floor_count, floor_count, foundation_type, superstructure_type, created_by_id, created_by_name"
    )
    .single();

  if (error) {
    console.error("Error creating job estimate project details:", error);
    throw new Error(error.message || "Failed to save project details.");
  }

  await syncJobEstimateBasics(details.jobEstimateProjectId, details);

  return data;
}

async function syncJobEstimateBasics(
  estimateId: number,
  details: JobEstimateProjectDetails
) {
  const { error } = await supabase
    .from("job_estimate")
    .update({
      project_name: details.projectName.trim(),
      project_type: details.projectType.trim(),
    })
    .eq("id", estimateId);

  if (error) {
    console.error("Error syncing job estimate basics:", error);
    throw new Error(error.message || "Failed to sync job estimate basics.");
  }
}

function toNullableText(value: string) {
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function toNullableFloat(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toNullableInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toNullableBoolean(value: string) {
  if (!value.trim()) {
    return null;
  }

  if (value === "Yes") {
    return true;
  }

  if (value === "No") {
    return false;
  }

  return null;
}
