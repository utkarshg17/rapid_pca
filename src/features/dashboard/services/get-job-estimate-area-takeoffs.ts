import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateAreaTakeoff,
  JobEstimateAreaTakeoffRecord,
} from "@/features/dashboard/types/job-estimate";

export async function getJobEstimateAreaTakeoffs(
  estimateId: number
): Promise<JobEstimateAreaTakeoff[]> {
  const { data, error } = await supabase
    .from("job_estimate_area_takeoffs")
    .select("id, created_at, job_estimate_id, room_type, area, unit, floor_finish")
    .eq("job_estimate_id", estimateId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching area takeoffs:", error);
    return [];
  }

  return ((data ?? []) as JobEstimateAreaTakeoffRecord[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    jobEstimateId: row.job_estimate_id,
    roomType: row.room_type ?? "",
    area: row.area === null ? "" : String(row.area),
    unit: row.unit ?? "sq.ft",
    floorFinish: row.floor_finish ?? "",
  }));
}
