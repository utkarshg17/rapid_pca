import { supabase } from "@/lib/supabase/client";
import type {
  ProductionLogEntry,
  ProductionLogRecord,
} from "@/features/projects/types/production-log";

export async function getProductionLogEntries(
  projectId: number
): Promise<ProductionLogEntry[]> {
  const { data, error } = await supabase
    .from("production_log")
    .select(
      "id, created_at, project_id, record_date, sub_contractor, trade, man_hours, quantity, unit, rate, amount, item, cost_code, created_by_id, created_by_name"
    )
    .eq("project_id", projectId)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching production log entries:", error);
    return [];
  }

  return ((data ?? []) as ProductionLogRecord[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    projectId: row.project_id,
    recordDate: row.record_date,
    subContractorId: null,
    subContractorName: row.sub_contractor,
    item: row.item,
    costCode: row.cost_code,
    trade: row.trade,
    manHours: Number(row.man_hours ?? 0),
    quantity: Number(row.quantity ?? 0),
    unit: row.unit,
    rate: Number(row.rate ?? 0),
    rateUnit: deriveRateUnit(row.unit),
    amount: Number(row.amount ?? 0),
    createdById: row.created_by_id,
    createdBy: row.created_by_name,
  }));
}

function deriveRateUnit(unit: string) {
  const normalizedUnit = unit.trim();

  return normalizedUnit ? `INR/${normalizedUnit}` : "INR";
}
