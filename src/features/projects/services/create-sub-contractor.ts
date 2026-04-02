import { supabase } from "@/lib/supabase/client";
import type { SubContractorRecord } from "@/features/projects/types/production-log";

type CreateSubContractorInput = {
  name: string;
  trade: string;
  rate: number;
  unit: string;
};

export async function createSubContractor(
  input: CreateSubContractorInput
): Promise<SubContractorRecord> {
  const { data, error } = await supabase
    .from("sub_contractor_database")
    .insert({
      sub_contractor_name: input.name.trim(),
      trade: input.trade.trim(),
      rate: input.rate,
      unit: input.unit.trim(),
    })
    .select("id, created_at, sub_contractor_name, trade, rate, unit")
    .single();

  if (error) {
    console.error("Error creating sub-contractor:", error);
    throw new Error(error.message || "Failed to create sub-contractor.");
  }

  return data as SubContractorRecord;
}
