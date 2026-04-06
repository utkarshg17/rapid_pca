import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateOpening,
  JobEstimateOpeningRecord,
  JobEstimateOpeningType,
} from "@/features/dashboard/types/job-estimate";

const validOpeningTypes = new Set<JobEstimateOpeningType>([
  "Door",
  "Window",
  "Ventilator",
  "Facade",
]);

export async function getJobEstimateOpenings(
  estimateId: number
): Promise<JobEstimateOpening[]> {
  const { data, error } = await supabase
    .from("job_estimate_openings")
    .select(
      "id, created_at, job_estimate_id, opening_type, opening_name, height, width, unit, quantity, description, sort_order"
    )
    .eq("job_estimate_id", estimateId)
    .order("opening_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching job estimate openings:", error);
    return [];
  }

  return ((data ?? []) as JobEstimateOpeningRecord[])
    .map((row) => {
      const openingType = normalizeOpeningType(row.opening_type);

      if (!openingType) {
        return null;
      }

      return {
        id: row.id,
        createdAt: row.created_at,
        jobEstimateId: row.job_estimate_id,
        openingType,
        openingName: row.opening_name ?? "",
        height: row.height === null ? "" : String(row.height),
        width: row.width === null ? "" : String(row.width),
        unit: row.unit ?? "mm",
        quantity: row.quantity === null ? "" : String(row.quantity),
        description: row.description ?? "",
        sortOrder: row.sort_order ?? 0,
      };
    })
    .filter((row): row is JobEstimateOpening => row !== null);
}

function normalizeOpeningType(value: string): JobEstimateOpeningType | null {
  return validOpeningTypes.has(value as JobEstimateOpeningType)
    ? (value as JobEstimateOpeningType)
    : null;
}
