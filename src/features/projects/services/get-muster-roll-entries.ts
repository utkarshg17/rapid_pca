import { supabase } from "@/lib/supabase/client";
import type {
  MusterRollEntry,
  MusterRollEntryRow,
  MusterRollRowRecord,
} from "@/features/projects/types/muster-roll";

export async function getMusterRollEntries(
  projectId: number
): Promise<MusterRollEntry[]> {
  const { data, error } = await supabase
    .from("muster_roll")
    .select(
      "id, created_at, record_date, project_id, petty_contractor_id, petty_contractor_name, crew_name, crew_type, regular_hours, overtime_hours, rate, advance_payment, advance_payment_description, entry_group_id, created_by_user_name, created_by_user_id"
    )
    .eq("project_id", projectId)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching muster roll entries:", error);
    return [];
  }

  const groupedEntries = new Map<string, MusterRollEntry>();

  ((data ?? []) as MusterRollRowRecord[]).forEach((row) => {
    const entryGroupId = row.entry_group_id
      ? String(row.entry_group_id)
      : String(row.id);
    const regularHours = Number(row.regular_hours ?? 0);
    const overtimeHours = Number(row.overtime_hours ?? 0);
    const rate = Number(row.rate ?? 0);
    const advancePayment = Number(row.advance_payment ?? 0);
    const isAdvancePayment = advancePayment > 0;
    const lineTotal = isAdvancePayment
      ? -advancePayment
      : ((regularHours + overtimeHours) * rate) / 12;

    const nextRow: MusterRollEntryRow = {
      rowId: row.id,
      pettyContractorId: row.petty_contractor_id,
      pettyContractorName: row.petty_contractor_name,
      crewName: row.crew_name,
      crewType: row.crew_type,
      regularHours,
      overtimeHours,
      rate,
      lineTotal,
      advancePayment,
      advancePaymentDescription: row.advance_payment_description ?? "",
    };

    const existingEntry = groupedEntries.get(entryGroupId);

    if (existingEntry) {
      existingEntry.rows.push(nextRow);
      existingEntry.totalRegularHours += regularHours;
      existingEntry.totalOvertimeHours += overtimeHours;
      existingEntry.totalAmount += lineTotal;
      existingEntry.advancePaymentAmount += advancePayment;
      if (isAdvancePayment && !existingEntry.advancePaymentDescription) {
        existingEntry.advancePaymentDescription =
          row.advance_payment_description ?? "";
      }
      existingEntry.pettyContractorSummary = buildPettyContractorSummary(
        existingEntry.rows.map((entryRow) => entryRow.pettyContractorName)
      );
      return;
    }

    groupedEntries.set(entryGroupId, {
      id: row.id,
      createdAt: row.created_at,
      recordDate: row.record_date,
      entryType: isAdvancePayment ? "advance-payment" : "hours",
      pettyContractorSummary: row.petty_contractor_name,
      createdBy: row.created_by_user_name,
      entryGroupId,
      totalRegularHours: regularHours,
      totalOvertimeHours: overtimeHours,
      totalAmount: lineTotal,
      advancePaymentAmount: advancePayment,
      advancePaymentDescription: row.advance_payment_description ?? "",
      rows: [nextRow],
    });
  });

  return Array.from(groupedEntries.values());
}

function buildPettyContractorSummary(names: string[]) {
  const uniqueNames = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean))
  );

  if (uniqueNames.length === 0) {
    return "N/A";
  }

  if (uniqueNames.length === 1) {
    return uniqueNames[0];
  }

  if (uniqueNames.length === 2) {
    return uniqueNames.join(", ");
  }

  return `${uniqueNames[0]} +${uniqueNames.length - 1} more`;
}
