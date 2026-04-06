import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateOpening,
  JobEstimateOpeningRecord,
  JobEstimateOpeningType,
} from "@/features/dashboard/types/job-estimate";

type SaveJobEstimateOpeningInput = {
  id?: number;
  jobEstimateId: number;
  openingType: JobEstimateOpeningType;
  openingName: string;
  height: string;
  width: string;
  unit: string;
  quantity: string;
  description: string;
  sortOrder: number;
};

export async function saveJobEstimateOpening(
  input: SaveJobEstimateOpeningInput
): Promise<JobEstimateOpening> {
  const payload = {
    job_estimate_id: input.jobEstimateId,
    opening_type: input.openingType,
    opening_name: toNullableText(input.openingName),
    height: toNullableFloat(input.height),
    width: toNullableFloat(input.width),
    unit: input.unit.trim() || "mm",
    quantity: toNullableInteger(input.quantity),
    description: toNullableText(input.description),
    sort_order: input.sortOrder,
  };

  const query = input.id
    ? supabase.from("job_estimate_openings").update(payload).eq("id", input.id)
    : supabase.from("job_estimate_openings").insert(payload);

  const { data, error } = await query
    .select(
      "id, created_at, job_estimate_id, opening_type, opening_name, height, width, unit, quantity, description, sort_order"
    )
    .single();

  if (error) {
    console.error("Error saving job estimate opening row:", error);
    throw new Error(error.message || "Failed to save opening row.");
  }

  const row = data as JobEstimateOpeningRecord;

  return {
    id: row.id,
    createdAt: row.created_at,
    jobEstimateId: row.job_estimate_id,
    openingType: row.opening_type as JobEstimateOpeningType,
    openingName: row.opening_name ?? "",
    height: row.height === null ? "" : String(row.height),
    width: row.width === null ? "" : String(row.width),
    unit: row.unit ?? "mm",
    quantity: row.quantity === null ? "" : String(row.quantity),
    description: row.description ?? "",
    sortOrder: row.sort_order ?? 0,
  };
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
