import { supabase } from "@/lib/supabase/client";
import type { SubContractorRecord } from "@/features/projects/types/production-log";

type UpdateSubContractorInput = {
  id: number;
  name: string;
  trade: string;
  rate: number;
  unit: string;
};

export async function updateSubContractor(
  input: UpdateSubContractorInput
): Promise<SubContractorRecord> {
  const { data, error } = await supabase
    .from("sub_contractor_database")
    .update({
      sub_contractor_name: input.name.trim(),
      trade: input.trade.trim(),
      rate: input.rate,
      unit: input.unit.trim(),
    })
    .eq("id", input.id)
    .select("id, created_at, sub_contractor_name, trade, rate, unit")
    .single();

  if (error) {
    console.error("Error updating sub-contractor:", error);
    throw new Error(error.message || "Failed to update sub-contractor.");
  }

  return data as SubContractorRecord;
}
