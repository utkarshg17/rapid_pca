import { supabase } from "@/lib/supabase/client";

type UpdateProductionLogEntryInput = {
  id: number;
  recordDate: string;
  subContractorName: string;
  trade: string;
  manHours: number;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  item: string;
  costCode: string;
  createdById: number;
  createdByName: string;
};

export async function updateProductionLogEntry(
  input: UpdateProductionLogEntryInput
) {
  const { error } = await supabase
    .from("production_log")
    .update({
      record_date: input.recordDate,
      sub_contractor: input.subContractorName.trim(),
      trade: input.trade,
      man_hours: input.manHours,
      quantity: input.quantity,
      unit: input.unit,
      rate: input.rate,
      amount: input.amount,
      item: input.item,
      cost_code: input.costCode,
      created_by_id: input.createdById,
      created_by_name: input.createdByName,
    })
    .eq("id", input.id);

  if (error) {
    console.error("Error updating production log entry:", error);
    throw new Error(error.message || "Failed to update production log entry.");
  }
}
