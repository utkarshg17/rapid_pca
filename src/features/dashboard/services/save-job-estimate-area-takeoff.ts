import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateAreaTakeoff,
  JobEstimateAreaTakeoffRecord,
} from "@/features/dashboard/types/job-estimate";

type SaveJobEstimateAreaTakeoffInput = {
  id?: number;
  jobEstimateId: number;
  roomType: string;
  area: string;
  unit: string;
  floorFinish: string;
};

export async function saveJobEstimateAreaTakeoff(
  input: SaveJobEstimateAreaTakeoffInput
): Promise<JobEstimateAreaTakeoff> {
  const payload = {
    job_estimate_id: input.jobEstimateId,
    room_type: toNullableText(input.roomType),
    area: toNullableFloat(input.area),
    unit: input.unit.trim() || "sq.ft",
    floor_finish: toNullableText(input.floorFinish),
  };

  const query = input.id
    ? supabase
        .from("job_estimate_area_takeoffs")
        .update(payload)
        .eq("id", input.id)
    : supabase.from("job_estimate_area_takeoffs").insert(payload);

  const { data, error } = await query
    .select("id, created_at, job_estimate_id, room_type, area, unit, floor_finish")
    .single();

  if (error) {
    console.error("Error saving area takeoff row:", error);
    throw new Error(error.message || "Failed to save area takeoff row.");
  }

  const row = data as JobEstimateAreaTakeoffRecord;

  return {
    id: row.id,
    createdAt: row.created_at,
    jobEstimateId: row.job_estimate_id,
    roomType: row.room_type ?? "",
    area: row.area === null ? "" : String(row.area),
    unit: row.unit ?? "sq.ft",
    floorFinish: row.floor_finish ?? "",
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
