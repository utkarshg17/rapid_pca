import { supabase } from "@/lib/supabase/client";
import type { SubContractorRecord } from "@/features/projects/types/production-log";

export async function getSubContractors(): Promise<SubContractorRecord[]> {
  const { data, error } = await supabase
    .from("sub_contractor_database")
    .select("id, created_at, sub_contractor_name, trade, rate, unit")
    .order("sub_contractor_name", { ascending: true });

  if (error) {
    console.error("Error fetching sub-contractors:", error);
    return [];
  }

  return (data ?? []) as SubContractorRecord[];
}
