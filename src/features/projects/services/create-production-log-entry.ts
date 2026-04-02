import { supabase } from "@/lib/supabase/client";

type CreateProductionLogEntryInput = {
  projectId: number;
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

export async function createProductionLogEntry(
  input: CreateProductionLogEntryInput
) {
  const { error } = await supabase.from("production_log").insert({
    project_id: input.projectId,
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
  });

  if (error) {
    console.error("Error creating production log entry:", error);
    throw new Error(error.message || "Failed to save production log entry.");
  }
}
