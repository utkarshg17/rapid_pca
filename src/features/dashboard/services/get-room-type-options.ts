import { supabase } from "@/lib/supabase/client";
import type { RoomTypeOption } from "@/features/dashboard/types/job-estimate";

export async function getRoomTypeOptions(): Promise<RoomTypeOption[]> {
  const { data, error } = await supabase
    .from("room_type_database")
    .select("id, room_name")
    .order("room_name", { ascending: true });

  if (error) {
    console.error("Error fetching room type options:", error);
    return [];
  }

  return (data ?? []) as RoomTypeOption[];
}
